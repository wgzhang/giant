import { getSkuStock, getShopList } from "./api";
import type { Options, Shop, SucceedCallback } from "./types";
import { createCallIntervalControl, log } from "./utils";

export async function create(
  options: Options,
  succeedCallback?: SucceedCallback
) {
  const factory = createCallIntervalControl(options.interval, options.maxRetry);
  const getSkuStockControl = factory(getSkuStock);
  const getShopListControl = factory(getShopList);

  return {
    loadShopList,
    pollSkuStatus,
  };

  async function pollSkuStatus(shops: Shop[]) {
    log("开始检查库存");
    const { userId, skus } = options;
    const countMap: Record<string, number> = {};

    while (true) {
      for (const sku of skus) {
        for (const shop of shops) {
          await worker(sku, shop);
        }
      }
    }

    async function worker(sku: string, shop: Shop) {
      const key = `${sku}-${shop.code}`;
      const count = countMap[key] || 1;
      countMap[key] = count + 1;
      log(`开始检查库存 (第 ${count} 次): ${sku} ${shop.name}`);

      try {
        const resp = await getSkuStockControl(sku, shop.code, userId);
        if (resp.status !== 1) {
          throw new Error(`未知错误: ${resp.status}, ${resp.msg}`);
        }

        if (resp.data.stock > 0) {
          log(`${shop.name} ${sku} 库存有货!!!`);
          succeedCallback?.(sku, shop);
        }
      } catch (e) {
        log(`检查库存 ${sku} ${shop.name} 出错了`);
      }
    }
  }

  async function loadShopList() {
    log("开始加载商店列表");
    let page = 1;
    const shops: Shop[] = [];
    while (true) {
      log(`正在加载第${page}页`);
      const resp = await getShopListControl(page, options.shop);
      if (resp.status !== 1) {
        throw new Error(`未知错误: ${resp.status}, ${resp.msg}`);
      }

      if (resp.data.length === 0) {
        break;
      }

      shops.push(...resp.data);
      page++;
    }
    log(`商店列表加载完成, 共 ${shops.length} 个`);
    return shops;
  }
}