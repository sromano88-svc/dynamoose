import "source-map-support/register";
import { Schema, SchemaDefinition } from "./Schema";
import { Condition } from "./Condition";
import { Document, AnyDocument } from "./Document";
import { ModelType } from "./General";
declare const _default: {
    model: {
        <T extends Document = AnyDocument>(name: string, schema?: Schema | SchemaDefinition | (Schema | SchemaDefinition)[], options?: Partial<import("./Model").ModelOptions>): ModelType<T>;
        defaults: any;
    };
    Schema: typeof Schema;
    Condition: typeof Condition;
    transaction: (transactions: any[], settings: import("./Transaction").TransactionSettings, callback: import("./General").CallbackType<any, any>) => any;
    aws: {
        sdk: typeof import("aws-sdk");
        ddb: typeof import("./aws/ddb");
        converter: typeof import("./aws/converter");
    };
    logger: {
        pause: () => void;
        resume: () => void;
        status: () => "active" | "paused";
        providers: {
            set: (provider: any) => void;
            clear: () => void;
            add: (provider: any) => void;
            delete: (id: string | string[]) => void;
            list: () => any[];
        };
    };
    UNDEFINED: symbol;
    THIS: symbol;
};
export = _default;
