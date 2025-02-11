# GitHub Paywall App

This is a simple app that proides a possible solution to how one with a GitHub App can provide a paywall for access to code. 

## Overview

The code in this repository is an API that handles webhook events that the GitHub App is subscribed to. In this case we are just handeling the event of a new installation to an organization.

## Security

This GitHub App is set up with a webhook secret. We use this secret to verify that the webhook events are coming from GitHub. This is set by the environment variable `WEBHOOK_SECRET`.

## Actions on new Installation

When a new installation is created, the app will create a new repository in the organization. This repository is based on a public template, containing some workflows to get started which use our GitHub Action. We are also creating two secrets in the repository, one contains the installation id, and the other contains a PAT token.

This action is utilizing another GitHub Action we have in a private repository. To access it we are using the PAT token we created stored in the repository secrets. This PAT token is scoped to have read access to the content of the private repository containing the action, allowing the "customer" access to it.

The new repo also contains instructions on steps the "customer" needs to take to get started with this. How they need to create a GitHub App for their organization, and what secrets they need to set in order to create a PAT for this GitHub App. This PAT is then passed as input to our private action, which uses this to get the GitHub Copilot usage for the organization.

## Paywall

The paywall is implemented by making this App available on the GitHub Marketplace, requiring a subscription to use. This way we can ensure that only paying customers can use this App.
