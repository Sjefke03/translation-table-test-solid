import { describe, expect, it } from "vitest";
import { dataTypes, TYPE, translations } from "../src/registry";
import { readPod, type FetchFn } from "../src/solid";
import { Translator } from "../src/translator";

const translator = new Translator(dataTypes, translations);
const POD = "https://carol.pod.example";

const docs: Record<string, string> = {
  [`${POD}/profile/card`]: `@prefix solid: <http://www.w3.org/ns/solid/terms#>.
    <#me> solid:publicTypeIndex </settings/publicTypeIndex.ttl>; solid:privateTypeIndex </settings/privateTypeIndex.ttl>.`,
  [`${POD}/settings/publicTypeIndex.ttl`]: `@prefix solid: <http://www.w3.org/ns/solid/terms#>.
    <#a> a solid:TypeRegistration; solid:forClass <http://schema.org/Recipe>; solid:instance </recipes.ttl>.
    <#b> a solid:TypeRegistration; solid:forClass <https://hospital-b.example/vocab#BodyWeightLb>; solid:instance </w.ttl>.`,
  [`${POD}/w.ttl`]: `<#w> a <https://hospital-b.example/vocab#BodyWeightLb>; <https://hospital-b.example/vocab#weightLb> 150.`,
};

// Only serves public documents; the private type index needs authentication.
const fakeFetch: FetchFn = async (url) =>
  url in docs ? new Response(docs[url], { headers: { "content-type": "text/turtle" } }) : new Response("", { status: 401 });

describe("readPod", () => {
  it("reads known classes, lists unknown ones and reports unauthorised indexes", async () => {
    const pod = await readPod(`${POD}/profile/card#me`, translator, fakeFetch);
    expect(pod.resources).toEqual([{ url: `${POD}/w.ttl`, type: TYPE.weightLbB, records: [{ id: `${POD}/w.ttl#w`, data: { weightLb: 150 } }] }]);
    expect(pod.unknownClasses).toEqual(["http://schema.org/Recipe"]);
    expect(pod.warnings).toEqual([`GET ${POD}/settings/privateTypeIndex.ttl -> 401`]);
  });
});
