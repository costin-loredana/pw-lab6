-- ── Schema ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
    id          VARCHAR(64)  PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    color       VARCHAR(16)  NOT NULL DEFAULT '#9e9e9e',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id          VARCHAR(32)    PRIMARY KEY,
    date        DATE           NOT NULL,
    amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    category_id VARCHAR(64)    NOT NULL REFERENCES categories(id),
    description TEXT           NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_config (
    id     INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
    amount NUMERIC(12, 2)
);

-- Indexes for pagination / filtering performance
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id);
-- idx_expenses_month omis (DATE_TRUNC nu e IMMUTABLE pe coloana DATE)

-- ── Seed: default categories ───────────────────────────────────────

INSERT INTO categories (id, name, color) VALUES
    ('food',          'Alimentatie & Produse',      '#2e7d32'),
    ('transport',     'Transport & Combustibil',    '#546e7a'),
    ('housing',       'Chirie & Servicii Comunale', '#455a64'),
    ('health',        'Sanatate & Farmacie',        '#c62828'),
    ('entertainment', 'Timp Liber & Cultura',       '#1565c0'),
    ('shopping',      'Cumparaturi & Haine',        '#6a1b9a'),
    ('other',         'Diverse',                    '#9e9e9e')
ON CONFLICT (id) DO NOTHING;

-- ── Seed: singleton salary row ─────────────────────────────────────

INSERT INTO salary_config (id, amount) VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;