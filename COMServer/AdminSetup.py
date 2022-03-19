import os

from flask_swagger import swagger
from flask_swagger_ui import get_swaggerui_blueprint

from ServerCom import get_app
from error_wrapper import wrap_error

SWAGGER_URL = '/swagger'  # URL for exposing Swagger UI (without trailing '/')
API_URL = '/spec'  # Our API url (can of course be a local resource)

curr_path = os.path.dirname(os.path.abspath(__file__))
app = get_app()

def init():
    swaggerui_blueprint = get_swaggerui_blueprint(
        SWAGGER_URL,  # Swagger UI static files will be mapped to '{SWAGGER_URL}/dist/'
        API_URL,
        config={  # Swagger UI config overrides
            'app_name': "Test application"
        }
    )

    app.register_blueprint(swaggerui_blueprint)

@app.route('/info', methods=['GET'])
@wrap_error()
def get_version():
    global curr_path
    global app
    with open(curr_path + '/version', 'r') as f:
        return f'WordWave COM Server V{f.readline()} on env {app.env}'


@app.route("/spec")
def spec():
    return swagger(app)
