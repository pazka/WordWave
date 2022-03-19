FROM python:3


WORKDIR /

COPY ./requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV secret WillBeChangedButNotCommited
ENV LOGIN admin
ENV MDP admin
ENV PORT 80

EXPOSE 80

CMD [ "python", "app.py" ]