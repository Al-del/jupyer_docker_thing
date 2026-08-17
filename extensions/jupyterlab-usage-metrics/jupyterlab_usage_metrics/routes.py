import json
import os
import zipfile

import psutil
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado


class MetricsHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        cpu = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        self.finish(json.dumps({
            "cpu_percent": cpu,
            "memory": {"used": mem.used, "total": mem.total, "percent": mem.percent},
        }))


class ExtractHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        data = json.loads(self.request.body)
        path = data.get("path", "")

        root = os.path.normcase(os.path.normpath(
            self.contents_manager.root_dir
        ))
        abs_path = os.path.normcase(os.path.normpath(
            os.path.join(root, path)
        ))

        if os.path.commonpath([root, abs_path]) != root:
            raise tornado.web.HTTPError(403, "Access denied")

        if not os.path.isfile(abs_path):
            raise tornado.web.HTTPError(404, f"File not found: {abs_path}")

        if not abs_path.lower().endswith(".zip"):
            raise tornado.web.HTTPError(400, "Not a zip file")

        extract_dir = os.path.splitext(abs_path)[0]
        os.makedirs(extract_dir, exist_ok=True)

        with zipfile.ZipFile(abs_path, "r") as zf:
            zf.extractall(extract_dir)

        self.finish(json.dumps({
            "message": f"Extracted to {os.path.relpath(extract_dir, root)}"
        }))


def setup_route_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    handlers = [
        (url_path_join(base_url, "jupyterlab-usage-metrics", "metrics"), MetricsHandler),
        (url_path_join(base_url, "jupyterlab-usage-metrics", "extract"), ExtractHandler),
    ]
    web_app.add_handlers(host_pattern, handlers)
