import type { Schema, Attribute } from '@strapi/strapi';

export interface ShareTaskDetails extends Schema.Component {
  collectionName: 'components_share_task_details';
  info: {
    displayName: 'TaskDetails';
    description: '';
  };
  attributes: {
    name: Attribute.String;
    description: Attribute.String;
    due_date: Attribute.Date;
    progess: Attribute.Integer;
    time_create: Attribute.Date;
  };
}

export interface ShareSkill extends Schema.Component {
  collectionName: 'components_share_skills';
  info: {
    displayName: 'Skill';
    icon: 'alien';
  };
  attributes: {
    name: Attribute.String;
  };
}

export interface ShareCheckIn extends Schema.Component {
  collectionName: 'components_share_check_ins';
  info: {
    displayName: 'Check In';
    icon: 'alien';
    description: '';
  };
  attributes: {
    name: Attribute.String;
    time: Attribute.DateTime;
    latitude: Attribute.String;
    longitude: Attribute.String;
    isLocation: Attribute.Boolean;
    distance: Attribute.Decimal;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'share.task-details': ShareTaskDetails;
      'share.skill': ShareSkill;
      'share.check-in': ShareCheckIn;
    }
  }
}
