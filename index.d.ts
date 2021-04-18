// Type definitions for posthog-node
// Project: Posthog

declare module "posthog-node" {
  interface Option {
    flushAt?: number;
    flushInterval?: number;
    host?: string;
    api_host?: string;
    enable?: boolean;
  }

  interface CommonParamsInterfacePropertiesProp {
    [key: string]:
      | string
      | number
      | Array<any | { [key: string]: string | number }>;
  }

  interface IdentifyMessage {
    distinctId: string;
    properties?: CommonParamsInterfacePropertiesProp;
  }

  interface EventMessage extends IdentifyMessage {
    event: string;
  }

  export default class PostHog {
    constructor(apiKey: string, options: Option);
    /**
     * @description Capture allows you to capture anything a user does within your system,
     * which you can later use in PostHog to find patterns in usage,
     * work out which features to improve or where people are giving up.
     * A capture call requires:
     * @param distinctId which uniquely identifies your user
     * @param event We recommend using [verb] [noun], like movie played or movie updated to easily identify what your events mean later on.
     * @param properties OPTIONAL | which can be a dict with any information you'd like to add
     */
    capture({ distinctId, event, properties }: EventMessage): PostHog;

    /**
     * @description Identify lets you add metadata on your users so you can more easily identify who they are in PostHog,
     * and even do things like segment users by these properties.
     * An identify call requires:
     * @param distinctId which uniquely identifies your user
     * @param properties with a dict with any key: value pairs
     */
    identify({ distinctId, properties }: IdentifyMessage): PostHog;

    /**
     * @description To marry up whatever a user does before they sign up or log in with what they do after you need to make an alias call.
     * This will allow you to answer questions like "Which marketing channels leads to users churning after a month?"
     * or "What do users do on our website before signing up?"
     * In a purely back-end implementation, this means whenever an anonymous user does something, you'll want to send a session ID with the capture call.
     * Then, when that users signs up, you want to do an alias call with the session ID and the newly created user ID.
     * The same concept applies for when a user logs in. If you're using PostHog in the front-end and back-end,
     *  doing the identify call in the frontend will be enough.:
     * @param distinctId the current unique id
     * @param alias the unique ID of the user before
     */
    alias(data: { distinctId: string; alias: string }): PostHog;
  }
}
