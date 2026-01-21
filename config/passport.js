const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return done(null, false, { message: 'Account is deactivated' });
    }

    const isValidPassword = await user.validatePassword(password);
    
    if (!isValidPassword) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    // Update last login
    await user.update({ last_login: new Date() });

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar'],
    accessType: 'offline',
    prompt: 'consent'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists with this Google ID
      let user = await User.findOne({ where: { google_id: profile.id } });

      if (!user) {
        // Check if user exists with this email
        user = await User.findOne({ 
          where: { email: profile.emails[0].value } 
        });

        if (user) {
          // Link Google account to existing user
          await user.update({
            google_id: profile.id,
            google_access_token: accessToken,
            google_refresh_token: refreshToken,
            google_connected: true,
            last_login: new Date()
          });
        } else {
          // Create new user
          user = await User.create({
            full_name: profile.displayName,
            email: profile.emails[0].value,
            google_id: profile.id,
            google_access_token: accessToken,
            google_refresh_token: refreshToken,
            google_connected: true,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            account_type: 'staff',
            is_active: true,
            last_login: new Date()
          });
        }
      } else {
        // Update tokens
        await user.update({
          google_access_token: accessToken,
          google_refresh_token: refreshToken || user.google_refresh_token,
          google_connected: true,
          last_login: new Date()
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

module.exports = passport;
