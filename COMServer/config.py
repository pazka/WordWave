# See : https://djangostars.com/blog/configuring-django-settings-best-practices/

import json
import re
import os

__config = {}
__conf_name = "NONE"

"""
    Standalone config management util.
    It will read a specified JSON config file (or created it if it doesn't exist)
    and parse any value that is written like ${ENV_VAR_NAME} with it's os equivalent
    
    There basic config is as follow : 
        {
        "ENV" : "DEV",
        "DEV":{}
        }
"""


def init_config(config_path):
    """
    Read and search for the ENV key in the config file(json) to set the current config
    
    @param config_path: config path to read or create the config at
    @return: the current parsed config
    """
    __full_config = {}
    __config_f = None

    # creating default file
    if not os.path.isfile(config_path):
        with open(config_path, "w", encoding="utf-8") as created_file:
            created_file.write('{"ENV" : "DEV","DEV":{}}')

    # opening default file
    try:
        with open(config_path, "r", encoding="utf-8") as __config_f:
            __full_config = json.load(__config_f)
    except FileNotFoundError as e:
        raise FileNotFoundError(
            f"The config file {config_path} was not found.") from e
    except Exception as e:
        raise Exception(
            f"The config file could not be JSON parsed") from e

    def __try_parse_env_var_from_config(varname):
        if re.match('^\$\{(.*)\}$', varname):
            env_var_name = re.findall('^\$\{(.*)\}$', varname)[0]
            try:
                return os.environ[env_var_name]
            except Exception as e:
                raise KeyError(
                    f"The environment variable {env_var_name} doesn't exist but is needed for the configuration") from e
        else:
            return varname

            # prepping useful function

    def __recurs_parse_env_vars(config):
        """
            Will parse every value that written like "${SOME_VALUE}"
            with the value stored in the environment variable named SOME_VALUE

            If the envvar dosen't exist, it raises an error
        """
        for (key, val) in config.items():
            if isinstance(val, dict):
                config[key] = __recurs_parse_env_vars(val)
            elif isinstance(val, str):
                config[key] = __try_parse_env_var_from_config(val)
                return config

    # parse env vars
    __full_config = __recurs_parse_env_vars(__full_config)

    # Check basic env keys
    if "ENV" not in __full_config:
        raise KeyError("The 'ENV' key is not present in the config file. Unable to set the current environment")

    if __full_config["ENV"] not in __full_config:
        raise KeyError(
            f'The {__full_config["ENV"]} key is not present in the config.json. '
            f'Unable to set the current environment')

    # make config available
    global __config
    global __conf_name

    __conf_name = __try_parse_env_var_from_config(__full_config["ENV"])
    __config = __full_config[__full_config["ENV"]]
    return __config


def get_config(key=""):
    """
    @param key: optional, key to search, in the format "key.key2.key3" for nested props
    @return: The whole config if no key was specified, the value otherwise
    """
    global __config
    global __conf_name

    if key.strip() != "" and re.match('(\w\.?)*', key) is None:
        raise KeyError("The key must be in the format 'key.key1.key2'")

    val = __config
    # search for other dict inside the sub_dict
    for sub_key in key.split('.'):
        if sub_key != "":
            try:
                val = val[sub_key]
            except Exception as e:
                raise KeyError(f"The key {key} wasn't found in the config {__conf_name}")

    return val
