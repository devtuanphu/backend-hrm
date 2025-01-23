import type { Schema, Attribute } from '@strapi/strapi';

export interface ShareUpgradeWage extends Schema.Component {
  collectionName: 'components_share_upgrade_wages';
  info: {
    displayName: 'UpgradeWage';
    description: '';
  };
  attributes: {
    userId: Attribute.Integer;
    amount: Attribute.Integer;
    date: Attribute.Date;
  };
}

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
    description: '';
  };
  attributes: {
    user: Attribute.Relation<
      'share.shift-employee-status',
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    status: Attribute.Enumeration<['Pending', 'Approved', 'Rejected']>;
    registeredAt: Attribute.DateTime;
    checkIn: Attribute.DateTime;
    checkOut: Attribute.DateTime;
  };
}

export interface ShareShiftArise extends Schema.Component {
  collectionName: 'components_share_shift_arises';
  info: {
    displayName: 'ShiftArise';
    description: '';
  };
  attributes: {
    date: Attribute.Date;
    startTime: Attribute.Time;
    endTime: Attribute.Time;
    rate: Attribute.Integer;
    statusStaff: Attribute.Component<'share.shift-employee-status', true>;
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

export interface SharePromotion extends Schema.Component {
  collectionName: 'components_share_promotions';
  info: {
    displayName: 'Promotion';
    icon: 'alien';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    detail: Attribute.Text;
    date: Attribute.Date;
  };
}

export interface ShareProduct extends Schema.Component {
  collectionName: 'components_share_products';
  info: {
    displayName: 'Product';
    icon: 'alien';
    description: '';
  };
  attributes: {
    name: Attribute.String;
    description: Attribute.Text;
    amount: Attribute.Integer;
    image: Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    priceImport: Attribute.Integer;
    priceExport: Attribute.Integer;
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

export interface ShareImportAndExportHistory extends Schema.Component {
  collectionName: 'components_share_import_and_export_histories';
  info: {
    displayName: 'ImportAndExportHistory';
    icon: 'alien';
    description: '';
  };
  attributes: {
    idProduct: Attribute.Integer;
    amount: Attribute.Decimal;
    type: Attribute.Enumeration<['EXPORT', 'IMPORT']>;
    date: Attribute.Date;
    userActionId: Attribute.Integer;
  };
}

export interface ShareDetailDayCheckIn extends Schema.Component {
  collectionName: 'components_share_detail_day_check_ins';
  info: {
    displayName: 'DetailDayCheckIn';
    icon: 'alien';
  };
  attributes: {
    date: Attribute.Date;
    detail: Attribute.Component<'share.day-check-in', true>;
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

export interface ShareDayCheckIn extends Schema.Component {
  collectionName: 'components_share_day_check_ins';
  info: {
    displayName: 'DayCheckIn';
    icon: 'alien';
    description: '';
  };
  attributes: {
    checkIn: Attribute.DateTime;
    checkOut: Attribute.DateTime;
    nameStaff: Attribute.String;
    position: Attribute.String;
    work: Attribute.String;
    wage: Attribute.Integer;
    userId: Attribute.Integer;
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
    wage: Attribute.Integer;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'share.upgrade-wage': ShareUpgradeWage;
      'share.task-details': ShareTaskDetails;
      'share.shift': ShareShift;
      'share.shift-employee-status': ShareShiftEmployeeStatus;
      'share.shift-arise': ShareShiftArise;
      'share.reward': ShareReward;
      'share.request': ShareRequest;
      'share.rate-with-month': ShareRateWithMonth;
      'share.promotion': SharePromotion;
      'share.product': ShareProduct;
      'share.list-time-keeping': ShareListTimeKeeping;
      'share.import-and-export-history': ShareImportAndExportHistory;
      'share.detail-day-check-in': ShareDetailDayCheckIn;
      'share.detail-check-in': ShareDetailCheckIn;
      'share.day-check-in': ShareDayCheckIn;
      'share.config': ShareConfig;
      'share.check-in': ShareCheckIn;
    }
  }
}
