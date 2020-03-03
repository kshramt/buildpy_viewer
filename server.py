import json
import os

import flask


LATEST_VERSION = 5


class Err(Exception):
    pass


def mkdir(path):
    return os.makedirs(path, exist_ok=True)


def jp(path, *more):
    """
    >>> jp(".", "a")
    'a'
    >>> jp("a", "b")
    'a/b'
    >>> jp("a", "b", "..")
    'a'
    >>> jp("a", "/b", "c")
    'a/b/c'
    """
    return os.path.normpath(os.path.sep.join((path, os.path.sep.join(more))))


DATA_DIR = os.environ.get("EBS_DATA_DIR", "data")
DATA_BASENAME = os.environ.get("EBS_DATA_BASENAME", "defined")
PORT = os.environ.get("PORT", 8888)

NO_ESTIMATION = 0


app = flask.Flask(
    __name__, static_folder=jp("build", "static"), template_folder="build"
)


@app.route("/")
def root():
    res = flask.make_response(flask.render_template("index.html"))
    res.headers["Cache-Control"] = "no-store"
    return res


@app.route("/api/v1/get")
def get():
    with open(jp(DATA_DIR, DATA_BASENAME) + ".jsonl") as fp:
        data = list(map(json.loads, fp))
    res = flask.make_response(flask.json.jsonify(data))
    res.headers["Cache-Control"] = "no-store"
    return res


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=PORT)
