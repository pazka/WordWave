#!/bin/sh
# Admin UI feature check (upgrade safety net, see TESTING.md).
# Asserts the BUILT Speech2TextWeb bundle still contains the admin features, by their visible
# texts, field names and the REST routes they call. Catches a dependency bump (MUI, React,
# react-scripts...) that builds fine but silently drops or tree-shakes a part of the admin UI.
#
#   sh scripts/check-admin-bundle.sh Speech2TextWeb/build      # after `npm run build`
#   (scripts/smoke.sh runs it on the JS served by the image)
#
# POSIX sh + grep -F only: runs in node:*-alpine (CI fronts job) and Git Bash.
set -eu

DIR="${1:?usage: check-admin-bundle.sh <build dir containing static/js/*.js>}"
JS="$(find "$DIR" -path '*static/js/*' -name '*.js' 2>/dev/null)"
[ -n "$JS" ] || { echo "ADMIN BUNDLE FAIL: no static/js/*.js under $DIR" >&2; exit 1; }

missing=0
need() { # need <what> <literal>
  # shellcheck disable=SC2086 # $JS is a newline-separated file list without spaces
  if ! cat $JS | grep -qF -- "$2"; then echo "ADMIN BUNDLE FAIL: $1: '$2' not found" >&2; missing=1; fi
}

# login form (App.js) and Basic auth (services/rest.js)
need "login panel"          "Admin credentials"
need "login field"          '"login"'
need "password field"       '"mdp"'
need "password label"       '"password"'
need "login button"         "Login"
need "logged-in state"      "Logged in !"
need "login route"          "/login"
need "basic auth"           "Basic "
# word sending (AdminPanel.js)
need "manual text panel"    "Manual Text Input"
need "manual text submit"   "Submit Manuel Text"
need "words route"          "/words"
need "text/plain body"      "text/plain"
need "exclude panel"        "Additional Exclude Word"
need "exclude submit"       "Submit additional Exclude Words"
need "exclude route"        "/words/exclude"
need "speech result"        "Speech Result"
need "server result"        "Server Result"
# client visuals (AdminPanel.js)
need "reset visual"         "Reset visual"
need "reload clients"       "Reload visualizer in all clients"
need "reload route"         "/reload"
# speech recognition (SpeechSection.js)
need "speech panel"         "Speech Recognition Control"
need "start listening"      "Start Listening"
need "stop listening"       "Stop Listening"
need "retry switch"         "Retry when fail"
need "continuous switch"    "Continous Speech"
# downloads (NormalPanel.js) and server info (App.js)
need "downloads panel"      "Words Download"
need "csv download"         "WordOccurrences.csv"
need "csv route"            "/words/current/csv_count"
need "info route"           "/info"

[ "$missing" = 0 ] || exit 1
echo "ADMIN BUNDLE OK ($DIR)"
