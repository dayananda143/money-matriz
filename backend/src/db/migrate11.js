const { query } = require('./index');

// A semantic layer: the rules that normally live in route code, written down once
// in the database. Anything reading these views gets the same answer the screens
// give, which is the whole point — a reported number that disagrees with the app
// is worse than no number.
async function migrate() {

  // Base view. Sells are recorded per user+stock+group rather than against a
  // particular purchase, so a partial sale has to be matched to lots: oldest
  // first. Everything else is built on this.
  await query(`
    CREATE OR REPLACE VIEW v_lots AS
    WITH buys AS (
      SELECT t.*,
        SUM(t.quantity) OVER (
          PARTITION BY t.user_id, t.stock_id, t.group_id
          ORDER BY t.executed_at, t.id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cum_qty
      FROM transactions t
      WHERE t.type = 'buy'
    ),
    sells AS (
      SELECT user_id, stock_id, group_id,
        SUM(quantity)               AS sold_qty,
        SUM(quantity * price)       AS sell_amount,
        SUM(COALESCE(brokerage, 0)) AS sell_brokerage,
        MAX(executed_at)            AS last_sell_date
      FROM transactions
      WHERE type = 'sell'
      GROUP BY user_id, stock_id, group_id
    ),
    alloc AS (
      SELECT b.*,
        COALESCE(sl.sold_qty, 0)       AS group_sold_qty,
        COALESCE(sl.sell_amount, 0)    AS group_sell_amount,
        COALESCE(sl.sell_brokerage, 0) AS group_sell_brokerage,
        sl.last_sell_date,
        LEAST(b.quantity, GREATEST(0, COALESCE(sl.sold_qty, 0) - (b.cum_qty - b.quantity))) AS sold_quantity
      FROM buys b
      LEFT JOIN sells sl
        ON sl.user_id = b.user_id AND sl.stock_id = b.stock_id
       AND sl.group_id IS NOT DISTINCT FROM b.group_id
    ),
    alloc2 AS (
      -- Proceeds are shared over the quantity FIFO allocated, not the raw sold
      -- quantity. They differ only where recorded sells exceed recorded buys
      -- (rounding in older rows); this keeps the sale's full value attributed.
      SELECT a.*, SUM(a.sold_quantity) OVER (
        PARTITION BY a.user_id, a.stock_id, a.group_id
      ) AS group_alloc_qty
      FROM alloc a
    )
    SELECT
      a.id                                   AS lot_id,
      a.user_id, u.name  AS investor, u.user_type,
      a.stock_id, s.symbol, s.name AS stock_name, s.sector, s.market_cap_category,
      a.group_id, g.label AS transaction_label,
      a.executed_at                          AS bought_on,
      a.last_sell_date                       AS sold_on,
      a.quantity                             AS bought_quantity,
      a.price                                AS buy_price,
      a.total                                AS invested,
      ROUND(a.sold_quantity::numeric, 4)                     AS sold_quantity,
      ROUND((a.quantity - a.sold_quantity)::numeric, 4)      AS held_quantity,
      CASE WHEN ROUND((a.quantity - a.sold_quantity)::numeric, 2) <= 0
           THEN 'exited' ELSE 'active' END                   AS status,
      -- Cost is taken from the amount actually invested, pro-rated. Recomputing it
      -- as quantity * price loses rupees, because quantity is rounded to 2dp while
      -- the amount is exact.
      ROUND((CASE WHEN a.quantity > 0
             THEN a.total * (a.sold_quantity / a.quantity) ELSE 0 END)::numeric, 2) AS cost_of_sold,
      ROUND((CASE WHEN a.quantity > 0
             THEN a.total * ((a.quantity - a.sold_quantity) / a.quantity) ELSE 0 END)::numeric, 2) AS cost_of_held,
      ROUND((CASE WHEN a.group_alloc_qty > 0
             THEN a.group_sell_amount * (a.sold_quantity / a.group_alloc_qty) ELSE 0 END)::numeric, 2) AS proceeds,
      ROUND((CASE WHEN a.group_alloc_qty > 0
             THEN a.group_sell_brokerage * (a.sold_quantity / a.group_alloc_qty) ELSE 0 END)::numeric, 2) AS sell_brokerage,
      s.current_price, s.previous_close
    FROM alloc2 a
    JOIN users  u ON u.id = a.user_id
    JOIN stocks s ON s.id = a.stock_id
    LEFT JOIN stock_groups g ON g.id = a.group_id
  `);

  // What someone holds right now, and how it moved today.
  await query(`
    CREATE OR REPLACE VIEW v_positions AS
    SELECT
      user_id, investor, user_type,
      stock_id, symbol, stock_name, sector, market_cap_category,
      group_id, transaction_label,
      MIN(bought_on)                                    AS first_bought_on,
      SUM(held_quantity)                                AS quantity,
      SUM(cost_of_held)                                 AS invested,
      -- Left unrounded on purpose: a metrics layer rounds at the edge, so callers
      -- can sum many rows without each one drifting a paisa.
      SUM(held_quantity * current_price)                      AS current_value,
      SUM(held_quantity * current_price) - SUM(cost_of_held)  AS unrealised_pnl,
      SUM(held_quantity * (current_price - previous_close))   AS todays_change,
      MAX(current_price) AS current_price
    FROM v_lots
    WHERE held_quantity > 0
    GROUP BY user_id, investor, user_type, stock_id, symbol, stock_name, sector,
             market_cap_category, group_id, transaction_label
  `);

  // What someone has already sold, with the profit the system actually recognises.
  await query(`
    CREATE OR REPLACE VIEW v_realised AS
    SELECT
      user_id, investor, user_type,
      stock_id, symbol, stock_name, sector,
      group_id, transaction_label,
      MIN(bought_on) AS first_bought_on,
      MAX(sold_on)   AS sold_on,
      SUM(sold_quantity)  AS quantity_sold,
      SUM(cost_of_sold)   AS cost,
      SUM(proceeds)       AS proceeds,
      SUM(sell_brokerage) AS brokerage,
      SUM(proceeds) - SUM(cost_of_sold)                      AS realised_pnl,
      SUM(proceeds) - SUM(cost_of_sold) - SUM(sell_brokerage) AS realised_after_brokerage,
      -- Holding period decides the rate: over a year is long-term.
      CASE WHEN MAX(sold_on) IS NULL THEN NULL
           WHEN MAX(sold_on)::date - MIN(bought_on)::date > 365 THEN 'long term'
           ELSE 'short term' END AS gain_type
    FROM v_lots
    WHERE sold_quantity > 0
    GROUP BY user_id, investor, user_type, stock_id, symbol, stock_name, sector,
             group_id, transaction_label
  `);

  // Trades with the ids already resolved to names.
  await query(`
    CREATE OR REPLACE VIEW v_transactions AS
    SELECT
      t.id, t.executed_at AS happened_on, t.type AS side,
      u.id AS user_id, u.name AS investor, u.user_type,
      s.id AS stock_id, s.symbol, s.name AS stock_name, s.sector,
      g.label AS transaction_label,
      t.quantity, t.price, t.total AS amount, COALESCE(t.brokerage, 0) AS brokerage,
      t.investment_settled, t.pnl_settled, t.notes
    FROM transactions t
    JOIN users u  ON u.id = t.user_id
    JOIN stocks s ON s.id = t.stock_id
    LEFT JOIN stock_groups g ON g.id = t.group_id
  `);

  // Who is who, with their adviser where one is recorded.
  await query(`
    CREATE OR REPLACE VIEW v_people AS
    SELECT
      u.id AS user_id, u.name, u.email, u.user_type, u.role, u.is_active,
      sh.name AS managed_by,
      COALESCE(b.cash_balance, 0) AS cash_balance,
      (SELECT COUNT(*) FROM v_positions p WHERE p.user_id = u.id)  AS open_positions,
      (SELECT COALESCE(SUM(p.current_value), 0) FROM v_positions p WHERE p.user_id = u.id) AS portfolio_value
    FROM users u
    LEFT JOIN balances b ON b.user_id = u.id
    LEFT JOIN relationships r ON r.client_id = u.id
    LEFT JOIN users sh ON sh.id = r.shareholder_id
  `);

  console.log('migrate11: views ready — v_lots, v_positions, v_realised, v_transactions, v_people');
}

migrate().catch(e => { console.error(e); process.exit(1); });
