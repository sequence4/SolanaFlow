export interface Account {
  name: string;
  type: string;
  description: string;
}

export interface Input {
  name: string;
  type: string;
  value: string;
}

export interface ErrorCode {
  code: number;
  name: string;
  msg: string;
}

export interface EventField {
  name: string;
  type: string;
}

export interface Event {
  name: string;
  fields: EventField[];
}

export interface TransformedInstruction {
  id: string;
  name: string;
  description: string;
  status: string;
  accounts: Account[];
  inputs: Input[];
  errorCodes: ErrorCode[];
  events: Event[];
  codePreview: string;
} 