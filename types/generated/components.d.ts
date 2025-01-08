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

export interface ShareShift extends Schema.Component {
  collectionName: 'components_share_shifts';
  info: {
    displayName: 'shift';
    description: '';
  };
  attributes: {
    name: Attribute.String;
    startTime: Attribute.Time;
    endTime: Attribute.Time;
    skills: Attribute.Relation<'share.shift', 'oneToMany', 'api::skill.skill'>;
    maxEmployees: Attribute.Integer;
  };
}

export interface ShareShiftEmployeeStatus extends Schema.Component {
  collectionName: 'components_share_shift_employee_statuses';
  info: {
    displayName: 'ShiftEmployeeStatus';
  };
  attributes: {
    user: Attribute.Relation<
      'share.shift-employee-status',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    status: Attribute.Enumeration<['Pending', 'Approved', 'Rejected']>;
    registeredAt: Attribute.DateTime;
  };
}

export interface ShareReward extends Schema.Component {
  collectionName: 'components_share_rewards';
  info: {
    displayName: 'reward';
    icon: 'alien';
    description: '';
  };
  attributes: {
    reson: Attribute.String;
    amount: Attribute.Integer;
    date: Attribute.Date;
    type: Attribute.Enumeration<['reward', 'penalty']>;
  };
}

export interface ShareRequest extends Schema.Component {
  collectionName: 'components_share_requests';
  info: {
    displayName: 'request';
    icon: 'alien';
  };
  attributes: {
    name: Attribute.String;
    detail: Attribute.Text;
    userId: Attribute.Integer;
  };
}

export interface ShareRateWithMonth extends Schema.Component {
  collectionName: 'components_share_rate_with_months';
  info: {
    displayName: 'rateWithMonth';
    icon: 'alien';
  };
  attributes: {
    wage: Attribute.Decimal;
    startDay: Attribute.Date;
    endDay: Attribute.Date;
  };
}

export interface ShareListTimeKeeping extends Schema.Component {
  collectionName: 'components_share_list_time_keepings';
  info: {
    displayName: 'listTimeKeeping';
    icon: 'alien';
  };
  attributes: {
    timekeeper: Attribute.Relation<
      'share.list-time-keeping',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ShareDetailCheckIn extends Schema.Component {
  collectionName: 'components_share_detail_check_ins';
  info: {
    displayName: 'detailCheckIn';
    icon: 'alien';
    description: '';
  };
  attributes: {
    type: Attribute.Enumeration<['day', 'shift', 'hours']> &
      Attribute.DefaultTo<'hours'>;
    description: Attribute.Text;
  };
}

export interface ShareConfig extends Schema.Component {
  collectionName: 'components_share_configs';
  info: {
    displayName: 'config';
    icon: 'alien';
    description: '';
  };
  attributes: {
    repeatCycle: Attribute.Enumeration<['weekly', 'monthly']>;
    remindDays: Attribute.Integer;
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
    userId: Attribute.Integer;
    isTimekeeper: Attribute.Boolean;
    userIdTimeKeeper: Attribute.Integer;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'share.task-details': ShareTaskDetails;
      'share.shift': ShareShift;
      'share.shift-employee-status': ShareShiftEmployeeStatus;
      'share.reward': ShareReward;
      'share.request': ShareRequest;
      'share.rate-with-month': ShareRateWithMonth;
      'share.list-time-keeping': ShareListTimeKeeping;
      'share.detail-check-in': ShareDetailCheckIn;
      'share.config': ShareConfig;
      'share.check-in': ShareCheckIn;
    }
  }
}
