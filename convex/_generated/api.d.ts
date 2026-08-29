/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as memberStats from "../memberStats.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as payments from "../payments.js";
import type * as products from "../products.js";
import type * as seed from "../seed.js";
import type * as sheetsSync from "../sheetsSync.js";
import type * as sheetsSyncData from "../sheetsSyncData.js";
import type * as stock from "../stock.js";
import type * as stockReconcile from "../stockReconcile.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  memberStats: typeof memberStats;
  members: typeof members;
  migrations: typeof migrations;
  payments: typeof payments;
  products: typeof products;
  seed: typeof seed;
  sheetsSync: typeof sheetsSync;
  sheetsSyncData: typeof sheetsSyncData;
  stock: typeof stock;
  stockReconcile: typeof stockReconcile;
  transactions: typeof transactions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
