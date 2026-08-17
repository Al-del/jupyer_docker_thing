import json
import os
import zipfile

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado


class ExtractHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        data = json.loads(self.request.body)
        path = data.get("path", "")

        # Use the contents manager root as the authoritative root dir
        root = os.path.normcase(os.path.normpath(
            self.contents_manager.root_dir
        ))
        abs_path = os.path.normcase(os.path.normpath(
            os.path.join(root, path)
        ))

        # Safety: ensure the resolved path stays inside the root dir
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
        (url_path_join(base_url, "jupyterlab-file-utils", "extract"), ExtractHandler),
    ]
    web_app.add_handlers(host_pattern, handlers)
