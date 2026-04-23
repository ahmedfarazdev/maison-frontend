export type DraftStatus = {
  id?: string;
  clientTempId?: string;
  statusCode: string;
  label: string;
  colorToken: string;
  isTerminal: boolean;
  active: boolean;
};

export type DraftTransition = {
  id?: string;
  fromStatusCode: string;
  toStatusCode: string;
  condition: string;
  active: boolean;
};
