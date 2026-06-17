export async function getHistoricalCharts(tickers = ["BTC", "ETH", "SOL", "DOGE"]) {
  const history = {};

  try {
    // Fetch data for all coins concurrently
    const promises = tickers.map(async (ticker) => {
      // We map our base tickers to Binance trading pairs (e.g., BTC -> BTCUSDT)
      const symbol = `${ticker}USDT`;
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=60`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${symbol}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Binance returns an array of arrays. We just need time and close price.
      // Index 0: Open time, Index 4: Close price
      history[ticker] = data.map((kline) => ({
        time: kline[0],
        price: parseFloat(kline[4]),
      }));
    });

    await Promise.all(promises);
    return history;
  } catch (error) {
    console.error("Error fetching historical charts:", error);
    // Return empty arrays as fallback so the frontend doesn't crash
    tickers.forEach(t => { if (!history[t]) history[t] = []; });
    return history;
  }
}
