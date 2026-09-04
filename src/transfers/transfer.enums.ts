export enum TransferStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum TransferFailureCode {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED',
}
