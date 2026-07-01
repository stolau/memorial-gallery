from functools import wraps

from flask import jsonify, session
from flask_babel import gettext


def _is_authed() -> bool:
    return bool(session.get("authed"))


def api_login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not _is_authed():
            return jsonify(error=gettext("Authentication required.")), 401
        return view(*args, **kwargs)

    return wrapped
