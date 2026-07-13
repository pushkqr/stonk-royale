import { useEffect, useRef } from "react";
import { createChart, LineSeries, createSeriesMarkers } from "lightweight-charts";

export default function ChartWidget({ activeCoin, livePrice, myTrades, historicalData }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const lineSeriesRef = useRef(null);
  const markersPrimitiveRef = useRef(null);

  // 1. Chart Initialization
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#d1d5db",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const lineSeries = chart.addSeries(LineSeries, {
      color: "#00E5FF",
      lineWidth: 2,
    });

    chartRef.current = chart;
    lineSeriesRef.current = lineSeries;

    // Seed historical data
    if (historicalData) {
      const hist = historicalData[activeCoin];
      if (hist) {
        try {
          const uniqueHist = [];
          const seenTimes = new Set();
          
          hist.forEach((d) => {
            const t = Math.floor(d.time / 1000);
            if (!seenTimes.has(t)) {
              seenTimes.add(t);
              uniqueHist.push({ time: t, value: d.price });
            } else {
              uniqueHist[uniqueHist.length - 1].value = d.price;
            }
          });

          uniqueHist.sort((a, b) => a.time - b.time);
          lineSeries.setData(uniqueHist);
        } catch (e) {
          console.error("Chart setData error", e);
        }
      }
    }

    // Handle Window Resize
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      // Reset refs so markers don't try to attach to a dead chart
      chartRef.current = null;
      lineSeriesRef.current = null;
      markersPrimitiveRef.current = null;
    };
  }, [activeCoin, historicalData]);

  // 2. Live Price Updates
  useEffect(() => {
    if (!lineSeriesRef.current || !livePrice) return;
    
    lineSeriesRef.current.update({
      time: Math.floor(Date.now() / 1000),
      value: livePrice,
    });
  }, [livePrice]);

  // 3. Update Chart Markers
  useEffect(() => {
    if (!lineSeriesRef.current) return;

    const coinTrades = myTrades.filter((t) => t.ticker === activeCoin);
    coinTrades.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const markers = coinTrades.map((t) => ({
      time: Math.floor(new Date(t.timestamp).getTime() / 1000),
      position: t.type === "BUY" ? "belowBar" : "aboveBar",
      color: t.type === "BUY" ? "#00E676" : "#FF1744",
      shape: t.type === "BUY" ? "arrowUp" : "arrowDown",
      text: `${t.type} ${t.quantity} @ $${t.price.toFixed(2)}`,
    }));

    if (markersPrimitiveRef.current) {
      markersPrimitiveRef.current.setMarkers(markers);
    } else {
      markersPrimitiveRef.current = createSeriesMarkers(
        lineSeriesRef.current,
        markers,
      );
      if (lineSeriesRef.current.attachPrimitive) {
        lineSeriesRef.current.attachPrimitive(markersPrimitiveRef.current);
      }
    }
  }, [myTrades, activeCoin]);

  return <div ref={chartContainerRef} style={{ flex: 1, minHeight: "0" }}></div>;
}
