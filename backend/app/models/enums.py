from enum import Enum


class TransactionType(Enum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"


class SourceType(Enum):
    SALES = "SALES"
    DEFECT = "DEFECT"
    BATCH = "BATCH"


class OrderStatus(Enum):
    DRAFT = "DRAFT"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"
