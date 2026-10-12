# 4H Po3 → IFVG → LRL bot (NQ/ES, Tradovate prop accounts)

A TradingView Pine Script strategy that:

1. **Backtests** your setup on NQ/ES so you can see whether it has an edge before you pay for an eval.
2. **Places trades automatically** on Tradovate through a webhook bridge (TradingView alert → bridge → Tradovate).
3. **Enforces your prop rules in code**: risk %, max loss, trailing drawdown, the $1,500/day consistency cap, a 2:1 maximum RR, and flattening before the close.

File: [`po3_ifvg_strategy.pine`](po3_ifvg_strategy.pine)

---

## How the strategy is coded (please check this)

ICT concepts are partly discretionary, so I had to turn them into exact rules. If any of these don't match how you trade, tell me and I'll change them.

| Concept | Rule in the code |
|---|---|
| **4H Po3** | The bot tracks the current 4H candle (its open, high and low) on the chart timeframe, using CME 4H candles: 18:00, 22:00, 02:00, 06:00, 10:00 and 14:00 ET. |
| **Manipulation** | Longs: the 4H candle must first sweep the **previous 4H low**. Shorts: it must sweep the previous 4H high. The alternative setting only requires price to trade beyond the 4H open. |
| **IFVG (entry)** | Longs: take the most recent **bearish FVG** formed inside the current 4H candle (the down/manipulation leg). When a candle **closes above the top of that gap**, the gap has inverted and the bot buys. Shorts are the mirror image. The default minimum gap size is 4 ticks. |
| **Po3 location** | Longs only while price is **below the 4H open**, shorts only while it's above. You can turn this off. |
| **Stop** | Beyond the manipulation extreme (the 4H candle's low for longs) plus a 4-tick buffer. Trades with a stop wider than 60 points are skipped. |
| **LRL target** | The opposite side of the **previous 4H candle** (its high for longs). The alternative setting targets the nearest untaken swing high or low. |
| **RR** | The take-profit is **capped at 2R**. Trades with less than 1R available to the target are skipped. |
| **Frequency** | At most one trade per 4H candle and 2 trades per day. Entries only between 09:30 and 14:00 ET, and everything is flattened at 15:50 ET. |

## Your account rules, as coded

| Rule | Eval | Funded |
|---|---|---|
| Risk per trade | 1% of $50k = **$500** | 0.5% = **$250** |
| Max loss | $2,000, **trailing end-of-day**, stops trailing at $50,000 | same |
| Profit target | $53,000, then the bot stops trading | n/a |
| Consistency | Position size is reduced so a full take-profit **can't take the day past +$1,500**. If it can't fit even 1 contract, the trade is skipped. | same |
| Extra guards | Optional $1,000 daily loss stop. The bot never risks more than the remaining room above the drawdown floor (minus a $100 buffer). | same |

These numbers look like a Topstep-style 50K, so I set the drawdown to trailing EOD with the floor locking at the starting balance. If your firm uses a static or intraday-trailing drawdown, change **Drawdown type** in the settings.

**Use micros (MNQ / MES).** With $500 risk and a 40-point NQ stop, a single NQ mini risks $800, which is over budget, but **6 MNQ** ($2/point) risks $480. For funded accounts, $250 of risk is often less than one mini contract. The bot reads the point value from whatever symbol is on the chart.

---

## Step 1: Backtest it (do this first)

1. Open TradingView and make a chart of **MNQ1!** (or MES1!) on the **5-minute** timeframe. Any timeframe from 1m to 15m works.
2. Open the **Pine Editor**, paste in the contents of `po3_ifvg_strategy.pine`, then click **Save** and **Add to chart**.
3. Open the **Strategy Tester** tab to see the net profit, win rate, drawdown and the list of trades.
4. For a long-history test of the setup by itself, open the strategy's settings and turn on **Research mode**. Otherwise the backtest stops as soon as the first simulated eval passes or fails.
5. Check the green and red triangles on the chart. They mark every IFVG-after-manipulation signal, so you can confirm the bot sees the same setups you would.

> I wrote this without access to a Pine compiler. If TradingView shows an error when you add it, paste the error to me and I'll fix it.
> For more realistic fills, turn on **Bar Magnifier** under Properties (needs a paid TradingView plan).

## Step 2: Forward-test on sim

Run it live on a **Tradovate demo/sim account** for at least a couple of weeks before using it on a paid eval.

## Step 3: Automate it (TradingView → Tradovate)

TradingView can't send orders to Tradovate by itself from a strategy, so you need a webhook bridge. Examples are TradersPost, PickMyTrade and CrossTrade; they connect your Tradovate account and turn TradingView alerts into orders.

1. Connect your Tradovate (prop) account in the bridge and copy its **webhook URL**.
2. In TradingView, right-click the strategy and choose **Add alert**:
   - Condition: the strategy, **Order fills only**
   - Message: `{{strategy.order.alert_message}}`
   - Notifications: enable **Webhook URL** and paste the bridge's URL. Webhooks need a paid TradingView plan.
3. Each entry sends a bracket order (entry + stop + target). Each exit or flatten sends a close:

   ```json
   {"ticker":"MNQ1!","action":"buy","quantity":6,"stopLoss":{"type":"stop","stopPrice":21010.25},"takeProfit":{"limitPrice":21090.75}}
   {"ticker":"MNQ1!","action":"exit"}
   ```

   This is **TradersPost-style** JSON. If you use a different bridge, check its docs and change the `jsonEntry` / `jsonExit` functions to match, or tell me which bridge you use and I'll do it. If the bridge expects a different symbol format, set **Ticker sent to bridge**.

TradingView runs alerts on its own servers, so your computer doesn't need to stay on.

---

## Before running it on a real eval

- **Confirm your prop firm allows automated trading and webhook bridges on the account.** Some firms allow it, some ban fully automated trading, and the rules change. Breaking them can void the account and your payouts.
- Check that the bot's daily reset (18:00 ET) and flatten time match your firm's session rules.
- Commission is set to $0.50 per contract per side. Change it under Properties to match your real cost.
- Past backtest results don't guarantee future results. The bot enforces discipline; it doesn't make a setup profitable.
