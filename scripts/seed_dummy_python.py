import os
import sqlite3
from datetime import datetime, timedelta

# Resolve database path (matches config/database.js)
DB_PATH = os.getenv("DATABASE_PATH") or os.path.join(os.path.dirname(__file__), "..", "database", "lawfirm.db")
DB_PATH = os.path.abspath(DB_PATH)

# Pre-hashed passwords using bcrypt (cost 10) to stay compatible with app login
PASSWORD_HASHES = {
    "admin123": "$2a$10$QaQAJQlLMcmW6KFmz4AzH.x70r6zRKLmtTpKPT/3OvTX58TnMhHOe",
    "attorney123": "$2a$10$xxpQj6cdtbUB7L8/sQd.J.jpk4L9ErpDKCnmj.r8au9rtwT0m.akS",
    "staff123": "$2a$10$J86QWgvjA17g9zAmoEKLJeK.3A029XeJdjwc/q.H2dGINsQgagxli",
    "client123": "$2a$10$98g1imofFO35VYOux2yCr.qfTs4txfCYAhoRcSNfOHSwSusYigDdS",
}

# Simple helper to run statements

def execute_many(cur, sql, rows):
    cur.executemany(sql, rows)


def now():
    return datetime.utcnow().isoformat(sep=" ")


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    print(f"Using database: {DB_PATH}")

    # Wipe tables in dependency-safe order
    tables = [
        "event_attendees",
        "events",
        "tasks",
        "invoice_bills",
        "payment_proofs",
        "invoices",
        "deposits",
        "cost_journals",
        "chat_messages",
        "documents",
        "matters",
        "contact_addresses",
        "contact_phones",
        "contact_emails",
        "contacts",
        "users",
    ]

    for tbl in tables:
        cur.execute(f"DELETE FROM {tbl};")
    conn.commit()

    ts = now()

    # Users
    users = [
        ("Admin User", "admin@lawfirm.com", PASSWORD_HASHES["admin123"], "admin", "+62812345678", "Law Firm Management", 0, True, ts, ts),
        ("John Attorney", "attorney@lawfirm.com", PASSWORD_HASHES["attorney123"], "attorney", "+62812345679", "Law Firm Management", 500000, True, ts, ts),
        ("Jane Staff", "staff@lawfirm.com", PASSWORD_HASHES["staff123"], "staff", "+62812345680", "Law Firm Management", 200000, True, ts, ts),
        ("Client Example", "client@example.com", PASSWORD_HASHES["client123"], "client", "+62812345681", "Example Corp", 0, True, ts, ts),
    ]
    execute_many(
        cur,
        """
        INSERT INTO users (full_name, email, password, account_type, phone, company, hourly_rate, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        users,
    )
    conn.commit()

    # Map ids
    cur.execute("SELECT id, account_type FROM users;")
    user_ids = {row[1]: row[0] for row in cur.fetchall()}

    # Contacts
    contacts = [
        ("individual", "Galih Primananda", True, "Client from Surabaya", user_ids["admin"], ts, ts),
        ("company", "Acme Manufacturing", True, "Key manufacturing client", user_ids["admin"], ts, ts),
        ("individual", "Budi Santoso", True, "Civil case", user_ids["admin"], ts, ts),
    ]
    execute_many(
        cur,
        """
        INSERT INTO contacts (entity_type, name, is_client, notes, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        contacts,
    )
    conn.commit()

    cur.execute("SELECT id, name FROM contacts;")
    contact_ids = {row[1]: row[0] for row in cur.fetchall()}

    # Contact details
    execute_many(
        cur,
        "INSERT INTO contact_emails (contact_id, email, email_type, is_primary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);",
        [
          (contact_ids["Galih Primananda"], "galih@example.com", "personal", 1, ts, ts),
          (contact_ids["Acme Manufacturing"], "legal@acme.co.id", "work", 1, ts, ts),
          (contact_ids["Budi Santoso"], "budi@example.com", "personal", 1, ts, ts),
        ],
    )
    execute_many(
        cur,
        "INSERT INTO contact_phones (contact_id, phone, phone_type, is_primary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);",
        [
          (contact_ids["Galih Primananda"], "+628123111111", "mobile", 1, ts, ts),
          (contact_ids["Acme Manufacturing"], "+622112345678", "office", 1, ts, ts),
          (contact_ids["Budi Santoso"], "+628119998888", "mobile", 1, ts, ts),
        ],
    )
    execute_many(
        cur,
        "INSERT INTO contact_addresses (contact_id, address, address_type, is_primary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);",
        [
          (contact_ids["Galih Primananda"], "Jl. Kenanga No.1, Sidoarjo", "home", 1, ts, ts),
          (contact_ids["Acme Manufacturing"], "Jl. Industri No.1, Jakarta", "office", 1, ts, ts),
          (contact_ids["Budi Santoso"], "Jl. Melati No.5, Bandung", "home", 1, ts, ts),
        ],
    )
    conn.commit()

    # Matters
    matters = [
        ("123", "matter 1", contact_ids["Galih Primananda"], user_ids["admin"], "sidoarjo", "litigation", "active", ts, ts, user_ids["admin"], "lalalalalalala"),
        ("MAT-2026-001", "Contract Review - Acme", contact_ids["Acme Manufacturing"], user_ids["attorney"], "Corporate", "Contract", "active", ts, None, user_ids["admin"], "Review and negotiate master service agreement"),
    ]
    execute_many(
        cur,
        """
        INSERT INTO matters (matter_number, matter_name, client_id, responsible_attorney_id, case_area, case_type, status, start_date, end_date, created_by, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        [(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], ts, ts) for m in matters],
    )
    conn.commit()
    cur.execute("SELECT id, matter_number FROM matters;")
    matter_ids = {row[1]: row[0] for row in cur.fetchall()}

    # Tasks
    execute_many(
        cur,
        """
        INSERT INTO tasks (task_type, matter_id, title, description, status, priority, start_date, due_date, assignee_id, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        [
          ("matter", matter_ids["123"], "Draft statement", "Prepare initial statement", "in_progress", "high", ts, (datetime.utcnow() + timedelta(days=3)).isoformat(sep=" "), user_ids["staff"], user_ids["admin"], ts, ts),
          ("matter", matter_ids["MAT-2026-001"], "Collect exhibits", "Gather supporting docs", "pending", "medium", ts, (datetime.utcnow() + timedelta(days=7)).isoformat(sep=" "), user_ids["staff"], user_ids["attorney"], ts, ts),
        ],
    )

    # Events (Calendar)
    execute_many(
        cur,
        """
        INSERT INTO events (title, description, start_datetime, end_datetime, location, category, matter_id, is_all_day, notification_minutes, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        [
          ("Kickoff call", "Project alignment", ts, (datetime.utcnow() + timedelta(hours=1)).isoformat(sep=" "), "Zoom", "Meeting", matter_ids["MAT-2026-001"], 0, 30, user_ids["attorney"], ts, ts),
          ("Court hearing", "Preliminary hearing", (datetime.utcnow() + timedelta(days=2)).isoformat(sep=" "), (datetime.utcnow() + timedelta(days=2, hours=2)).isoformat(sep=" "), "Pengadilan Negeri Bandung", "Hearing", matter_ids["123"], 0, 60, user_ids["attorney"], ts, ts),
        ],
    )

    # Invoices + bills
    execute_many(
        cur,
        """
        INSERT INTO invoices (invoice_number, matter_id, contact_id, issue_date, due_date, subtotal, tax_rate, tax_amount, discount_amount, total_amount, paid_amount, status, notes, has_installment, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        [
          ("INV-2026-001", matter_ids["MAT-2026-001"], contact_ids["Acme Manufacturing"], ts, (datetime.utcnow() + timedelta(days=14)).isoformat(sep=" "), 100000000, 11, 11000000, 0, 111000000, 30000000, "partial", "Advance billing", 1, user_ids["admin"], ts, ts)
        ],
    )
    conn.commit()
    cur.execute("SELECT id, invoice_number FROM invoices;")
    invoice_ids = {row[1]: row[0] for row in cur.fetchall()}

    execute_many(
        cur,
        "INSERT INTO invoice_bills (invoice_id, description, quantity, unit_price, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);",
        [
          (invoice_ids["INV-2026-001"], "Legal fees - MSA review", 10, 8000000, 80000000, ts, ts),
          (invoice_ids["INV-2026-001"], "Research and advisory", 5, 4000000, 20000000, ts, ts),
        ],
    )

    # Transactions: deposit + payment proof
    execute_many(
        cur,
        "INSERT INTO deposits (contact_id, matter_id, amount, deposit_date, status, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);",
        [
          (contact_ids["Acme Manufacturing"], matter_ids["MAT-2026-001"], 50000000, ts, "active", "Initial retainer", user_ids["admin"], ts, ts)
        ],
    )

    execute_many(
        cur,
        "INSERT INTO payment_proofs (invoice_id, amount, payment_date, payment_method, proof_file, notes, uploaded_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);",
        [
          (invoice_ids["INV-2026-001"], 30000000, ts, "Bank Transfer", None, "First installment", user_ids["staff"], ts, ts)
        ],
    )

    # Cost journals
    execute_many(
        cur,
        """
        INSERT INTO cost_journals (entry_type, matter_id, user_id, date, description, hours, rate, expense_category, amount, is_billable, is_billed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        [
          ("time", matter_ids["MAT-2026-001"], user_ids["attorney"], ts, "Contract review session", 2.5, 800000, None, None, 1, 0, ts, ts),
          ("expense", matter_ids["123"], user_ids["staff"], ts, "Travel to court", None, None, "Transport", 750000, 1, 0, ts, ts),
        ],
    )

    # Chat messages
    execute_many(
        cur,
        "INSERT INTO chat_messages (matter_id, user_id, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?);",
        [
          (matter_ids["123"], user_ids["admin"], "Mohon update dokumen bukti terbaru.", ts, ts),
          (matter_ids["123"], user_ids["staff"], "Sudah diunggah ke Documents, mohon dicek.", ts, ts),
        ],
    )

    conn.commit()
    conn.close()
    print("Dummy data inserted successfully.")


if __name__ == "__main__":
    main()
