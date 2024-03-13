/*
 * @author: MCBBC
 * @date: 2023-07-17
 * @customEditors: imsyy
 * @lastEditTime: 2023-07-17
 */

const Router = require("koa-router");
const kuaishouRouter = new Router();
const axios = require("axios");
const { get, set, del } = require("../utils/cacheData");

// 接口信息
const routerInfo = {
	name: "kuaishou",
	title: "快手",
	subtitle: "热榜",
};

// 缓存键名
const cacheKey = "kuaishouData";

// 调用时间
let updateTime = new Date().toISOString();

// 调用路径
const url = "https://www.kuaishou.com/?isHome=1";

// Unicode 解码
const decodedString = (encodedString) => {
	return encodedString.replace(/\\u([\d\w]{4})/gi, (match, grp) =>
		String.fromCharCode(parseInt(grp, 16)),
	);
};

// 数据处理
const getData = (data) => {
	if (!data) return [];
	const dataList = [];
	try {
		const pattern = /window.__APOLLO_STATE__=(.*);\(function\(\)/s;
		const idPattern = /clientCacheKey=([A-Za-z0-9]+)/s;
		const matchResult = data.match(pattern);
		const jsonObject = JSON.parse(matchResult[1])["defaultClient"];

		// 获取所有分类
		const allItems = jsonObject['$ROOT_QUERY.visionHotRank({"page":"home"})']["items"];
		// 遍历所有分类
		allItems.forEach((v) => {
			// 基础数据
			const image = jsonObject[v.id]["poster"];
			const id = image.match(idPattern)[1];
			// 数据处理
			dataList.push({
				title: jsonObject[v.id]["name"],
				pic: decodedString(image),
				hot: jsonObject[v.id]["hotValue"],
				url: `https://www.kuaishou.com/short-video/${id}`,
				mobileUrl: `https://www.kuaishou.com/short-video/${id}`,
			});
		});
		return dataList;
	} catch (error) {
		console.error("数据处理出错" + error);
		return false;
	}
};

// 快手热榜
kuaishouRouter.get("/kuaishou", async (ctx) => {
	console.log("获取快手热榜");
	try {
		// 从缓存中获取数据
		let data = await get(cacheKey);
		const from = data ? "cache" : "server";
		if (!data) {
			// 如果缓存中不存在数据
			console.log("从服务端重新获取快手热榜");
			// 从服务器拉取数据
			const response = await axios.get(url);
			data = getData(response.data);
			updateTime = new Date().toISOString();
			if (!data) {
				ctx.body = {
					code: 500,
					...routerInfo,
					message: "获取失败",
				};
				return false;
			}
			// 将数据写入缓存
			await set(cacheKey, data);
		}
		ctx.body = {
			code: 200,
			message: "获取成功",
			...routerInfo,
			from,
			total: data.length,
			updateTime,
			data,
		};
	} catch (error) {
		console.error(error);
		ctx.body = {
			code: 500,
			...routerInfo,
			message: "获取失败",
		};
	}
});

// 快手热榜 - 获取最新数据
kuaishouRouter.get("/kuaishou/new", async (ctx) => {
	console.log("获取快手热榜 - 最新数据");
	try {
		// 从服务器拉取最新数据
		const response = await axios.get(url);
		const newData = getData(response.data);
		updateTime = new Date().toISOString();
		console.log("从服务端重新获取快手热榜");

		// 返回最新数据
		ctx.body = {
			code: 200,
			message: "获取成功",
			...routerInfo,
			total: newData.length,
			updateTime,
			data: newData,
		};

		// 删除旧数据
		await del(cacheKey);
		// 将最新数据写入缓存
		await set(cacheKey, newData);
	} catch (error) {
		// 如果拉取最新数据失败，尝试从缓存中获取数据
		console.error(error);
		const cachedData = await get(cacheKey);
		if (cachedData) {
			ctx.body = {
				code: 200,
				message: "获取成功",
				...routerInfo,
				total: cachedData.length,
				updateTime,
				data: cachedData,
			};
		} else {
			// 如果缓存中也没有数据，则返回错误信息
			ctx.body = {
				code: 500,
				...routerInfo,
				message: "获取失败",
			};
		}
	}
});

kuaishouRouter.info = routerInfo;
module.exports = kuaishouRouter;
