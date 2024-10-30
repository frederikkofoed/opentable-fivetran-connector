# OpenTable Fivetran Connector
I wrote this function to be used as a custom Fivetran connector for the OpenTable sync API, and figured I'd share it in case anyone else can use it. Note, this requires access to the OpenTable Sync 2.0 API.

How to use:
1) Download or fork repo and deploy it as a Google Cloud Run or AWS Lambda function (Note: I'm using Google Cloud Run, so it may need some tweaking if you're using another service).
2) Set up a new Fivetran connector using your function service of choice, and follow Fivetran's instructions for giving Fivetran access to the function.
3) Configure your the rid, clientId, and clientSecret using the Secrets object in Fivetran.
4) Sync your data!

For more, see Fivetran's documentation on custom fuctions [here](https://fivetran.com/docs/connectors/functions).
