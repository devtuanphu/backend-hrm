import type { Schema, Attribute } from '@strapi/strapi';

export interface ShareCheckIn extends Schema.Component {
  collectionName: 'components_share_check_ins';
  info: {
    displayName: 'Check In';
    icon: 'alien';
  };
  attributes: {
    name: Attribute.String;
    time: Attribute.DateTime;
    location: Attribute.String;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'share.check-in': ShareCheckIn;
    }
  }
}
