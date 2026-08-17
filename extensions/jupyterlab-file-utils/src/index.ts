import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { showErrorMessage } from '@jupyterlab/apputils';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { LabIcon } from '@jupyterlab/ui-components';
import { requestAPI } from './request';

import extractSvgStr from '../style/icons/extract.svg';

const extractIcon = new LabIcon({
  name: 'file-utils:extract',
  svgstr: extractSvgStr
});

const EXTRACT_COMMAND_ID = 'jupyterlab-file-utils:extract-zip';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-file-utils:plugin',
  description: 'A JupyterLab extension for file utilities.',
  autoStart: true,
  requires: [IFileBrowserFactory],
  activate: (app: JupyterFrontEnd, browserFactory: IFileBrowserFactory) => {
    console.log('JupyterLab extension jupyterlab-file-utils is activated!');

    app.commands.addCommand(EXTRACT_COMMAND_ID, {
      label: 'Extract Zip',
      icon: extractIcon,
      isVisible: () => {
        const file =
          browserFactory.tracker.currentWidget?.selectedItems().next();
        return file?.value?.path?.toLowerCase().endsWith('.zip') ?? false;
      },
      execute: async () => {
        const item =
          browserFactory.tracker.currentWidget?.selectedItems().next();
        const path = item?.value?.path;
        if (!path) {
          return;
        }
        try {
          const result = await requestAPI<{ message: string }>(
            'extract',
            app.serviceManager.serverSettings,
            {
              method: 'POST',
              body: JSON.stringify({ path }),
              headers: { 'Content-Type': 'application/json' }
            }
          );
          console.log(result.message);
          await browserFactory.tracker.currentWidget?.model.refresh();
        } catch (err: any) {
          await showErrorMessage('Extract failed', err);
        }
      }
    });

    app.contextMenu.addItem({
      command: EXTRACT_COMMAND_ID,
      selector: '.jp-DirListing-item',
      rank: 10
    });
  }
};

export default plugin;
