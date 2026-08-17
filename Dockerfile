FROM quay.io/jupyter/minimal-notebook:latest

USER root

COPY extensions/jupyterlab-file-utils /opt/extensions/jupyterlab-file-utils
COPY extensions/jupyterlab-usage-metrics /opt/extensions/jupyterlab-usage-metrics
COPY requirements.txt /tmp/requirements.txt

RUN fix-permissions /opt/extensions /tmp/requirements.txt

USER ${NB_UID}

RUN mkdir -p "/home/${NB_USER}/.jupyter" \
    && printf 'c.ServerApp.token = ""\nc.ServerApp.password = ""\n' \
        > "/home/${NB_USER}/.jupyter/jupyter_server_config.py"

RUN pip install --no-cache-dir \
        --index-url https://download.pytorch.org/whl/cpu \
        torch torchvision

RUN pip install --no-cache-dir torchmetrics pytorch-lightning

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
USER ${NB_UID}

RUN pip install --no-cache-dir "setuptools<81"

RUN pip install --no-cache-dir -r /tmp/requirements.txt
RUN conda install -y -c conda-forge nodejs npm \ 
&& conda clean --all -f -y
RUN pip install --no-cache-dir \
        /opt/extensions/jupyterlab-file-utils \
        /opt/extensions/jupyterlab-usage-metrics \
    && jupyter labextension list \
    && jupyter server extension list \
    && fix-permissions "${CONDA_DIR}" "${HOME}"
