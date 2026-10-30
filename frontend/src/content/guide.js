// The in-app guide. Written as data so a task can be corrected without touching
// the page. `roles` decides who sees a section: a client never needs settlement.

export const GUIDE = [
  {
    id: 'model',
    title: 'How things are stored',
    roles: ['admin', 'shareholder'],
    items: [
      {
        q: 'What is a "Transaction" on a stock?',
        body: 'Three levels nest inside each other, and almost every mistake comes from missing the middle one.',
        steps: [
          'The stock is the company — SHAKTIPUMP. One entry, forever.',
          'A transaction is one round of buying that company. These are the tabs labelled Transaction 1, Transaction 2 inside a stock.',
          'The investors are the people whose money went into that particular round.',
        ],
        note: 'Buying the same company again six months later creates Transaction 2. It is kept entirely separate — its own investors, its own brokerage, its own profit. The two rounds are never averaged together.',
      },
      {
        q: 'What is the Stockholder, and is it the owner?',
        body: 'No. The Stockholder is whose demat account physically holds the shares. That is an administrative fact and says nothing about who owns the money — a transaction sitting in an employee\'s account can be owned by a dozen clients. Only employees and shareholders can hold; never a client.',
      },
      {
        q: 'What is the difference between a client, a shareholder and an employee?',
        body: 'Every person has two separate settings, and mixing them up is the most common early mistake.',
        steps: [
          'Type — client (an outside investor), shareholder (a partner who shares in the firm\'s profits), or employee (staff, who may hold shares in their demat on the firm\'s behalf).',
          'Access — user (their own data only), admin (everything), or super admin (admin plus platform settings).',
        ],
        note: 'These are independent. Being a shareholder does not make someone an admin. Today every admin happens to also be a shareholder, which makes it easy to assume the two travel together. They do not.',
      },
    ],
  },

  {
    id: 'buy',
    title: 'Recording an investment',
    roles: ['admin'],
    items: [
      {
        q: 'How do I add a stock and record a purchase?',
        body: 'The firm has bought a stock and you need to put it in the system.',
        steps: [
          'Go to Stocks and search for the company. If it is already listed, open it. If not, click Add Stock and enter the symbol as the exchange writes it — the name, sector and price are fetched for you.',
          'Click + New Transaction. It is named for you: Transaction 1 if this is the first round, Transaction 2 if there was an earlier one.',
          'Set the Stockholder — whose demat account the shares are sitting in.',
          'Click Add Investment. Enter the buy price and buy date once, then tick each investor and type the rupee amount they contributed.',
          'Enter the brokerage for the whole purchase in the Brokerage box at the top right and press + Add.',
        ],
        note: 'You enter money, not a number of shares — shares are worked out as amount ÷ price. Before you leave, check that Total Invested matches what the firm actually paid.',
      },
      {
        q: 'How do I add many investors at once?',
        body: 'Typing twenty investors by hand is slow and easy to get wrong. Use Bulk Import on the Stocks screen.',
        steps: [
          'Click Bulk Import, then Download Template.',
          'Fill the Transaction Details block at the top once — stock symbol, account holder, buy date, brokerage, buy price, notes. These apply to the whole sheet.',
          'Every active investor already has a row below. Type an Amount against the people who took part and leave everyone else blank.',
          'Save, then Upload Filled Template.',
          'Read the preview. Nothing is saved yet — rows with a cross are skipped and the reason is shown.',
          'If it looks right, click Confirm & Import.',
        ],
        note: 'A symbol that is not yet in the system is checked against Yahoo Finance and created for you. One it does not recognise is refused rather than guessed at.',
      },
      {
        q: 'Where does brokerage go?',
        body: 'Into the Brokerage box at the top of the transaction, once, as the broker\'s total for the whole purchase. It is never entered per investor — the system shares it out across investors in proportion to their profit when the transaction settles. Entering it per person multiplies your costs several times over.',
      },
    ],
  },

  {
    id: 'sell',
    title: 'Selling and settling',
    roles: ['admin'],
    items: [
      {
        q: 'How do I record a sale?',
        body: 'Open the stock, then open the transaction tab being sold.',
        steps: [
          'Everyone exiting together — click Sell All Shares and enter the sell price and date once.',
          'One person exiting — use the ⋮ menu on their row and choose Sell Shares.',
        ],
        note: 'A partial sale uses the oldest shares first. If someone bought into the same transaction twice, one row can show as exited while the other stays active. That is correct, not a bug.',
      },
      {
        q: 'What does settling mean, and what do the two tick boxes do?',
        body: 'Selling records the trade. Settling is the separate step of agreeing and paying out what each person is owed. Once everyone in a transaction has exited, a Settlement Summary button appears showing, per person, what they invested, what the sale realised, tax, their share, and the final figure.',
        steps: [
          'Inv. Settled — their original capital has been returned.',
          'P&L Settled — their share of the profit has been paid.',
        ],
        note: 'Tick each only when the money has actually moved. They are a record of payment, not a calculation.',
      },
      {
        q: 'How is the profit split, and what about a loss?',
        body: 'Brokerage comes off first, then tax, and what remains is split 30% to the investor and 70% to the firm, with the firm also remitting the tax. A loss is split the same way — the investor bears 30% and the firm absorbs 70%, shown as a negative figure because the firm is paying rather than receiving. Brokerage is the exception: the investor pays all of it either way.',
        steps: [
          'Held more than 365 days — 12.5% long-term capital gains.',
          'Held 365 days or fewer — 20% short-term capital gains.',
        ],
        note: 'Tax is only ever charged on a profit. A loss is never taxed.',
      },
    ],
  },

  {
    id: 'people',
    title: 'People and requests',
    roles: ['admin'],
    items: [
      {
        q: 'How do I add a person?',
        body: 'Go to Users and click Add User. Set their type (client, shareholder or employee) and their access level separately — the two are independent. A client sees only their own portfolio; an admin sees everything.',
      },
      {
        q: 'What do I do with a trade request?',
        body: 'A shareholder can ask for a buy or sell rather than doing it themselves. Requests appear under Trade Requests with a count in the sidebar. Open one, check the stock, quantity and price are sensible, then Approve or Reject.',
        note: 'Approving does not place a trade at a broker. Place the real trade yourself, then record it under Stocks as you would any other purchase.',
      },
      {
        q: 'How do price alerts work?',
        body: 'An alert watches one stock for a stop loss (price falls to or below) or a target (price rises to or above). Set them from Alerts or the ⋮ menu on a stock. A stock sitting below its stop loss alerts once a day, not every 15 minutes.',
        note: 'Alerts go to every shareholder, not only those holding that stock. And acknowledging an alert switches it off until someone re-arms it — use mark as read if you only want to clear the badge.',
      },
    ],
  },

  {
    id: 'wrong',
    title: 'When something looks wrong',
    roles: ['admin'],
    items: [
      {
        q: 'A position shows as active after it was sold',
        body: 'Each person\'s holding is kept as a running total alongside the full list of their trades. Almost always the two agree; if an edit goes astray they can drift apart. Open the stock — if there is a mismatch, an amber banner names who is affected and offers Recalculate from transactions. Click it. It rebuilds the totals from the actual trades and changes nothing else.',
        note: 'Do not use the row\'s Edit or Delete to fix a wrong total. On an already-sold position those change the underlying purchase record and will quietly rewrite or remove a real trade. Ask before deleting anything involving money.',
      },
      {
        q: 'Who changed this, and when?',
        body: 'Open Activity. Every change is recorded with who made it, what moved and the before and after values — including changes made directly in the database, which are flagged as not having come through the app. Filter by person, by what was touched, or by date.',
      },
    ],
  },

  {
    id: 'yours',
    title: 'Your portfolio',
    roles: ['shareholder', 'client'],
    items: [
      {
        q: 'What am I looking at?',
        body: 'My Portfolio shows what you hold now and what you have exited. Active holdings show the shares you still hold, what they cost, and what they are worth today. The Exited tab shows closed positions and what each one realised.',
      },
      {
        q: 'Why does my P&L change during the day?',
        body: 'Prices refresh automatically every 15 minutes while the Indian market is open — Monday to Friday, 9:15am to 3:30pm. Unrealised P&L moves with the market; realised P&L only changes when something is actually sold.',
      },
      {
        q: 'How do I ask to buy or sell?',
        body: 'Raise it under Trade Requests. An admin reviews it, places the trade, and records it — you will see it in your portfolio once it has been executed.',
        roles: ['shareholder'],
      },
    ],
  },
];
