import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { MainAreaWidget } from '@jupyterlab/apputils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { Widget } from '@lumino/widgets';
import { requestAPI } from './request';
import { MetricsWidget } from './widget';

const COMMAND_ID = 'jupyterlab-usage-metrics:open';
const POLL_MS = 2000;

interface IMetrics {
  cpu_percent: number;
  memory: { used: number; total: number; percent: number };
}

function gb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1);
}

function metricItem(
  label: string,
  pct: number,
  detail: string,
  barClass = ''
): string {
  return `
    <span class="jp-MetricsBtn-item">
      <span class="jp-MetricsBtn-label">${label}</span>
      <span class="jp-MetricsBtn-bar-wrap">
        <span class="jp-MetricsBtn-bar ${barClass}" style="width:${pct.toFixed(0)}%"></span>
      </span>
      <span class="jp-MetricsBtn-val">${detail}</span>
    </span>`;
}

function renderButton(node: HTMLElement, data: IMetrics): void {
  const cpuDetail = `${data.cpu_percent.toFixed(0)}%`;
  const ramDetail = `${gb(data.memory.used)}/${gb(data.memory.total)} GB`;

  node.innerHTML =
    metricItem('CPU', data.cpu_percent, cpuDetail) +
    metricItem('RAM', data.memory.percent, ramDetail);
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-usage-metrics:plugin',
  description: 'A JupyterLab extension for tracking usage metrics.',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension jupyterlab-usage-metrics is activated!');

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log(
            'jupyterlab-usage-metrics settings loaded:',
            settings.composite
          );
        })
        .catch(reason => {
          console.error(
            'Failed to load settings for jupyterlab-usage-metrics.',
            reason
          );
        });
    }

    let panel: MainAreaWidget<MetricsWidget> | null = null;

    app.commands.addCommand(COMMAND_ID, {
      label: 'Usage Metrics',
      execute: () => {
        if (!panel || panel.isDisposed) {
          const content = new MetricsWidget(
            app.serviceManager.serverSettings
          );
          panel = new MainAreaWidget({ content });
          panel.id = 'jupyterlab-usage-metrics-panel';
          panel.title.label = 'Usage Metrics';
          panel.title.closable = true;
        }
        if (!panel.isAttached) {
          app.shell.add(panel, 'main');
        }
        app.shell.activateById(panel.id);
      }
    });

    const button = new Widget();
    button.id = 'jupyterlab-usage-metrics-btn';
    button.addClass('jp-MetricsBtn');
    button.node.title = 'Open usage metrics';
    button.node.innerHTML = '<span class="jp-MetricsBtn-loading">Loading…</span>';
    button.node.addEventListener('click', () =>
      app.commands.execute(COMMAND_ID)
    );
    app.shell.add(button, 'top', { rank: 1000 });

    const poll = async () => {
      try {
        const data = await requestAPI<IMetrics>(
          'metrics',
          app.serviceManager.serverSettings
        );
        renderButton(button.node, data);
      } catch {
        // keep last display on error
      }
    };

    poll();
    setInterval(poll, POLL_MS);
  }
};

export default plugin;
