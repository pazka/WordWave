import traceback

from flask import Response

from config import get_config
from jsonlog import LOG, err_field, request_fields


class CustomException(Exception):
    client_detail = None

    def __init__(self, message):
        self.client_detail = message
        super().__init__(message)


class ClientError(CustomException):
    pass


class ServerError(CustomException):
    pass


def _hidden():
    try:
        from flask import current_app
        hide = current_app.extensions.get("hosh_log_hide")
        return hide() if hide else ()
    except RuntimeError:  # outside a request
        return ()


def get_trace(e):
    return traceback.format_exc()


def wrap_error(message=""):
    def wrapper(f):
        def wrapped(*args, **kwargs):
            trace = []
            if not get_config('wrap_errors'):
                return f(*args, **kwargs)

            try:
                return f(*args, **kwargs)
            except ClientError as e:
                trace = get_trace(e)
                err = e
                res = {'error': "An exception of type {0} occurred. Arguments:\n{1!r}".format(
                    type(e).__name__, e.args),
                    'trace': trace,
                    'server_message': message,
                    'client_detail': e.client_detail
                }
            except ServerError as e:
                trace = get_trace(e)
                err = e
                res = {'error': "An exception of type {0} occurred. Arguments:\n{1!r}".format(
                    type(e).__name__, e.args),
                    'trace': trace,
                    'server_message': message,
                    'client_detail': e.client_detail
                }

            except BaseException as e:
                trace = get_trace(e)
                err = e
                res = {'error': "An exception of type {0} occurred. Arguments:\n{1!r}".format(
                    type(e).__name__, e.args),
                    'trace': trace,
                    'server_message': message
                }

            # The client still gets the error body above (a known quirk, see TESTING.md); the log gets one
            # standard line, without the request body or a credential.
            LOG.error("route_error", "error intercepted, error body returned", **request_fields(),
                      err=err_field(err, _hidden()))
            return res

        wrapped.__name__ = f.__name__
        return wrapped

    return wrapper
