FROM python:3.11-slim

WORKDIR /

COPY COMServer/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Mirror the historical gulp buildBack layout: COMServer content at image root,
# with the PROD config shipped as config.json (it reads secret/LOGIN/MDP/PORT
# from the environment at startup).
COPY COMServer/ .
COPY COMServer/config.prod.json ./config.json

ENV secret=WillBeChangedButNotCommited
ENV LOGIN=admin
ENV MDP=admin
ENV PORT=80

EXPOSE 80

CMD [ "python", "app.py" ]
