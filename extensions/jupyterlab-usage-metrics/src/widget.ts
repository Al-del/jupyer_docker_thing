import { Widget } from '@lumino/widgets';
import { ServerConnection } from '@jupyterlab/services';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { requestAPI } from './request';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend
);

interface IMetrics {
  cpu_percent: number;
  memory: { used: number; total: number; percent: number };
}

const MAX_POINTS = 60;
const POLL_MS = 2000;

const CPU_COLOR = '#4285f4';
const RAM_COLOR = '#34a853';

function makeLabels(): string[] {
  return Array(MAX_POINTS).fill('');
}

function makeDataset(label: string, color: string) {
  return {
    label,
    data: Array<number>(MAX_POINTS).fill(0),
    borderColor: color,
    backgroundColor: color + '33',
    borderWidth: 2,
    pointRadius: 0,
    fill: true,
    tension: 0.3
  };
}

function push(arr: number[], value: number): void {
  arr.push(value);
  if (arr.length > MAX_POINTS) {
    arr.shift();
  }
}

function gb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1);
}

export class MetricsWidget extends Widget {
  private _serverSettings: ServerConnection.ISettings;
  private _intervalId: number | null = null;
  private _cpuChart: Chart | null = null;
  private _ramChart: Chart | null = null;

  constructor(serverSettings: ServerConnection.ISettings) {
    super();
    this.addClass('jp-UsageMetrics');
    this.title.label = 'Usage Metrics';
    this.title.closable = true;
    this._serverSettings = serverSettings;

    this.node.innerHTML = `
      <div class="jp-UsageMetrics-container">
        <h2 class="jp-UsageMetrics-title">Usage Metrics</h2>

        <div class="jp-UsageMetrics-section">
          <h3>CPU usage (%)</h3>
          <div class="jp-UsageMetrics-chart-wrap">
            <canvas id="jp-metrics-cpu-canvas"></canvas>
          </div>
        </div>

        <div class="jp-UsageMetrics-section">
          <h3>RAM usage (%)</h3>
          <div class="jp-UsageMetrics-chart-wrap">
            <canvas id="jp-metrics-ram-canvas"></canvas>
          </div>
          <p id="jp-metrics-ram-note" class="jp-UsageMetrics-note"></p>
        </div>
      </div>`;

    this._initCharts();
    this._fetch();
    this._intervalId = window.setInterval(() => this._fetch(), POLL_MS);
  }

  private _initCharts(): void {
    const chartOpts = () => ({
      animation: false as const,
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: { min: 0, max: 100, ticks: { callback: (v: unknown) => v + '%' } },
        x: { display: false }
      },
      plugins: { legend: { position: 'top' as const } }
    });

    const cpuCanvas = this.node.querySelector('#jp-metrics-cpu-canvas') as HTMLCanvasElement;
    this._cpuChart = new Chart(cpuCanvas, {
      type: 'line',
      data: { labels: makeLabels(), datasets: [makeDataset('CPU', CPU_COLOR)] },
      options: chartOpts()
    });

    const ramCanvas = this.node.querySelector('#jp-metrics-ram-canvas') as HTMLCanvasElement;
    this._ramChart = new Chart(ramCanvas, {
      type: 'line',
      data: { labels: makeLabels(), datasets: [makeDataset('RAM', RAM_COLOR)] },
      options: chartOpts()
    });
  }

  private async _fetch(): Promise<void> {
    try {
      const data = await requestAPI<IMetrics>('metrics', this._serverSettings);
      this._updateCharts(data);
    } catch (e) {
      console.error('Failed to fetch usage metrics', e);
    }
  }

  private _updateCharts(data: IMetrics): void {
    if (!this._cpuChart || !this._ramChart) {
      return;
    }

    push(this._cpuChart.data.datasets[0].data as number[], data.cpu_percent);
    push(this._ramChart.data.datasets[0].data as number[], data.memory.percent);

    const note = this.node.querySelector('#jp-metrics-ram-note') as HTMLElement;
    if (note) {
      note.textContent = `${gb(data.memory.used)}/${gb(data.memory.total)} GB used`;
    }

    this._cpuChart.update();
    this._ramChart.update();
  }

  dispose(): void {
    if (this._intervalId !== null) {
      window.clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._cpuChart?.destroy();
    this._ramChart?.destroy();
    super.dispose();
  }
}
