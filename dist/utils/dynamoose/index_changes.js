"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelIndexChangeType = void 0;
const obj = require("../object");
var ModelIndexChangeType;
(function (ModelIndexChangeType) {
    ModelIndexChangeType["add"] = "add";
    ModelIndexChangeType["delete"] = "delete";
})(ModelIndexChangeType = exports.ModelIndexChangeType || (exports.ModelIndexChangeType = {}));
const index_changes = (model, existingIndexes = []) => __awaiter(void 0, void 0, void 0, function* () {
    const output = [];
    const expectedIndexes = yield model.getIndexes();
    // Indexes to delete
    const deleteIndexes = existingIndexes.filter((index) => !(expectedIndexes.GlobalSecondaryIndexes || []).find((searchIndex) => obj.equals(index, searchIndex))).map((index) => ({ "name": index.IndexName, "type": ModelIndexChangeType.delete }));
    output.push(...deleteIndexes);
    // Indexes to create
    const createIndexes = (expectedIndexes.GlobalSecondaryIndexes || []).filter((index) => ![...output.map((i) => i.name), ...existingIndexes.map((i) => i.IndexName)].includes(index.IndexName)).map((index) => ({
        "type": ModelIndexChangeType.add,
        "spec": index
    }));
    output.push(...createIndexes);
    return output;
});
exports.default = index_changes;
//# sourceMappingURL=index_changes.js.map