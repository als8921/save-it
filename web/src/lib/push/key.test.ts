import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array } from "./key";

describe("urlBase64ToUint8Array", () => {
  it("decodes a standard URL-safe base64 string", () => {
    // "hello" base64url = "aGVsbG8"
    const result = urlBase64ToUint8Array("aGVsbG8");
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  it("handles dash and underscore (URL-safe charset)", () => {
    // url-safe: "-" and "_" map to "+" and "/" in standard base64
    // bytes [251, 255] => base64 "+/8="  => url-safe "-_8"
    const result = urlBase64ToUint8Array("-_8");
    expect(Array.from(result)).toEqual([251, 255]);
  });

  it("pads missing '=' characters", () => {
    // "hi" base64 = "aGk="; without padding "aGk"
    const result = urlBase64ToUint8Array("aGk");
    expect(Array.from(result)).toEqual([104, 105]);
  });

  it("returns a Uint8Array (not a regular array)", () => {
    const result = urlBase64ToUint8Array("aGVsbG8");
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
