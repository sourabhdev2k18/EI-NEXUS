import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export function TelemetryChart({ history }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Temp (C)', data: [], borderColor: '#FF8A3D', tension: 0.3, pointRadius: 0, borderWidth: 2 },
          { label: 'Vibration (mm/s x10)', data: [], borderColor: '#4FD1E8', tension: 0.3, pointRadius: 0, borderWidth: 2 },
          { label: 'Voltage (V /2)', data: [], borderColor: '#5B8DEF', tension: 0.3, pointRadius: 0, borderWidth: 2 },
          { label: 'Current (A)', data: [], borderColor: '#3ED598', tension: 0.3, pointRadius: 0, borderWidth: 2 }
        ]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: { legend: { labels: { color: '#7C8A9A', font: { size: 10, family: 'JetBrains Mono' }, boxWidth: 10 } } },
        scales: {
          x: { display: false },
          y: { ticks: { color: '#7C8A9A', font: { size: 10 } }, grid: { color: '#1a2430' } }
        }
      }
    });
    return () => chartRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!chartRef.current || !history.length) return;
    const last = history.slice(-60);
    chartRef.current.data.labels = last.map((item) => item.t);
    chartRef.current.data.datasets[0].data = last.map((item) => item.temperature);
    chartRef.current.data.datasets[1].data = last.map((item) => item.vibration * 10);
    chartRef.current.data.datasets[2].data = last.map((item) => item.voltage / 2);
    chartRef.current.data.datasets[3].data = last.map((item) => item.current);
    chartRef.current.update('none');
  }, [history]);

  return <canvas ref={canvasRef} height="90" aria-label="Telemetry chart" role="img" />;
}
