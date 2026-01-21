const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { Event, EventAttendee, Matter, User } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const { google } = require('googleapis');

// Build an OAuth client for the current user
const getOAuthClient = (user) => {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  );
  if (user?.google_refresh_token) {
    client.setCredentials({ refresh_token: user.google_refresh_token });
  }
  return client;
};

// Ensure we have a fresh access token and persist it
const ensureAccessToken = async (user) => {
  if (!user.google_refresh_token) return null;
  const client = getOAuthClient(user);
  const { token } = await client.getAccessToken();
  if (token) {
    await user.update({
      google_access_token: token,
      google_token_expiry: null,
      google_connected: true
    });
    client.setCredentials({
      access_token: token,
      refresh_token: user.google_refresh_token,
      expiry_date: null
    });
  }
  return client;
};

// Map our event model to Google Calendar schema
const toGoogleEvent = (ev) => {
  const start = ev.is_all_day
    ? { date: moment(ev.start_datetime).format('YYYY-MM-DD') }
    : { dateTime: ev.start_datetime };
  const end = ev.is_all_day
    ? { date: moment(ev.end_datetime).format('YYYY-MM-DD') }
    : { dateTime: ev.end_datetime };

  return {
    summary: ev.title,
    description: ev.description,
    location: ev.location,
    start,
    end
  };
};

// Calendar view
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { view = 'month', date } = req.query;
    const currentDate = date ? moment(date) : moment();
    const isAdmin = req.user?.account_type === 'admin';

    // Get events for current view
    let startDate, endDate;
    
    switch(view) {
      case 'day':
        startDate = currentDate.clone().startOf('day');
        endDate = currentDate.clone().endOf('day');
        break;
      case 'week':
        startDate = currentDate.clone().startOf('week');
        endDate = currentDate.clone().endOf('week');
        break;
      case 'year':
        startDate = currentDate.clone().startOf('year');
        endDate = currentDate.clone().endOf('year');
        break;
      case 'schedule':
        startDate = currentDate.clone().startOf('month');
        endDate = currentDate.clone().endOf('month');
        break;
      default: // month
        startDate = currentDate.clone().startOf('month');
        endDate = currentDate.clone().endOf('month');
    }

    const events = await Event.findAll({
      where: {
        ...(isAdmin ? {} : { created_by: req.user.id }),
        start_datetime: {
          [Op.between]: [startDate.toDate(), endDate.toDate()]
        }
      },
      include: [
        { model: Matter, as: 'matter' },
        { 
          model: EventAttendee, 
          as: 'attendees',
          include: [{ model: User, as: 'user' }]
        }
      ],
      order: [['start_datetime', 'ASC']]
    });

    res.render('calendar/index', {
      title: 'Calendar',
      events,
      view,
      currentDate: currentDate.format('YYYY-MM-DD'),
      moment
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading calendar');
    res.redirect('/dashboard');
  }
});

// Manual 2-way sync (push local unsynced to Google, pull remote to local)
router.post('/sync', isAuthenticated, async (req, res) => {
  try {
    const client = await ensureAccessToken(req.user);
    if (!client) {
      req.flash('error', 'Google Calendar not connected. Login via Google first.');
      return res.redirect('/calendar');
    }

    const calendar = google.calendar({ version: 'v3', auth: client });
    const windowStart = moment().subtract(30, 'days').toDate();
    const windowEnd = moment().add(90, 'days').toDate();

    // PUSH: send local unsynced events
    const localEvents = await Event.findAll({
      where: {
        created_by: req.user.id,
        start_datetime: { [Op.between]: [windowStart, windowEnd] }
      }
    });

    for (const ev of localEvents) {
      // Update existing Google event
      if (ev.google_event_id) {
        try {
          await calendar.events.update({
            calendarId: 'primary',
            eventId: ev.google_event_id,
            requestBody: toGoogleEvent(ev)
          });
          await ev.update({ synced_to_google: true });
          continue;
        } catch (e) {
          console.warn('Update Google event failed', e?.message || e);
        }
      }

      // Insert new Google event
      try {
        const { data } = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: toGoogleEvent(ev)
        });
        await ev.update({ google_event_id: data.id, synced_to_google: true });
      } catch (e) {
        console.warn('Insert Google event failed', e?.message || e);
      }
    }

    // PULL: import Google events into local
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    const items = data.items || [];
    for (const item of items) {
      if (item.status === 'cancelled') continue;
      const start = item.start?.dateTime || item.start?.date;
      const end = item.end?.dateTime || item.end?.date;
      if (!start || !end) continue;

      const payload = {
        title: item.summary || 'Untitled',
        description: item.description || null,
        location: item.location || null,
        start_datetime: item.start.dateTime ? new Date(item.start.dateTime) : moment(item.start.date).startOf('day').toDate(),
        end_datetime: item.end.dateTime ? new Date(item.end.dateTime) : moment(item.end.date).endOf('day').toDate(),
        is_all_day: !!item.start.date,
        created_by: req.user.id,
        google_event_id: item.id,
        synced_to_google: true
      };

      const existing = await Event.findOne({ where: { google_event_id: item.id } });
      if (existing) {
        await existing.update(payload);
      } else {
        await Event.create(payload);
      }
    }

    req.flash('success', 'Calendar synced with Google');
    res.redirect('/calendar');
  } catch (error) {
    console.error('Sync error', error);
    req.flash('error', 'Sync failed');
    res.redirect('/calendar');
  }
});

// Add event page
router.get('/add', isAuthenticated, async (req, res) => {
  try {
    const isAdmin = req.user?.account_type === 'admin';
    const matters = await Matter.findAll({
      where: isAdmin ? {} : {
        [Op.or]: [
          { created_by: req.user.id },
          { responsible_attorney_id: req.user.id }
        ]
      }
    });

    const users = await User.findAll({ where: { is_active: true } });

    res.render('calendar/form', {
      title: 'Add Event',
      event: null,
      matters,
      users,
      action: 'add'
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error loading form');
    res.redirect('/calendar');
  }
});

// Create event (+ optional Google push)
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const {
      title, description, start_datetime, end_datetime,
      location, category, matter_id, is_all_day,
      notification_minutes, hyperlink, attendees
    } = req.body;

    const event = await Event.create({
      title,
      description,
      start_datetime,
      end_datetime,
      location,
      category,
      matter_id: matter_id || null,
      is_all_day: is_all_day === 'true',
      notification_minutes: notification_minutes || 15,
      hyperlink,
      created_by: req.user.id
    });

    // Add attendees
    if (attendees && Array.isArray(attendees)) {
      for (const userId of attendees) {
        await EventAttendee.create({
          event_id: event.id,
          user_id: userId
        });
      }
    }

    // Push to Google if user is connected
    try {
      const client = await ensureAccessToken(req.user);
      if (client) {
        const calendar = google.calendar({ version: 'v3', auth: client });
        const { data } = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: toGoogleEvent(event)
        });
        await event.update({ google_event_id: data.id, synced_to_google: true });
      }
    } catch (e) {
      console.warn('Google sync (create) failed', e?.message || e);
    }

    req.flash('success', 'Event created successfully');
    res.redirect('/calendar');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error creating event');
    res.redirect('/calendar/add');
  }
});

// Delete event (also remove from Google when linked)
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    
    if (!event || event.created_by !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.google_event_id) {
      try {
        const client = await ensureAccessToken(req.user);
        if (client) {
          const calendar = google.calendar({ version: 'v3', auth: client });
          await calendar.events.delete({ calendarId: 'primary', eventId: event.google_event_id });
        }
      } catch (e) {
        console.warn('Google delete failed', e?.message || e);
      }
    }

    await event.destroy();
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting event' });
  }
});

module.exports = router;
