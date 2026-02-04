export const StatusEnum = ["ROJO", "AMARILLO", "VERDE"] as const;
export type Status = (typeof StatusEnum)[number];

export const statusSchema = { enum: StatusEnum } as const;
