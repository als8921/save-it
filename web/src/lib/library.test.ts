import { describe, expect, it } from "vitest";
import {
  folderDeleteMessage,
  PARA_OPTIONS,
  paraParamToCategory,
  categoryToParaParam,
  folderMoveOptions,
  isDuplicateNameError,
} from "./library";

describe("folderDeleteMessage", () => {
  it("링크가 없으면 단순 확인 문구", () => {
    expect(folderDeleteMessage(0)).toBe("이 폴더를 삭제할까요?");
  });
  it("링크가 있으면 개수를 포함해 경고", () => {
    expect(folderDeleteMessage(3)).toBe(
      "이 폴더와 안에 있는 링크 3개가 함께 삭제됩니다. 삭제할까요?",
    );
  });
});

describe("PARA_OPTIONS", () => {
  it("PARA 4개 + 미지정 순서로 구성", () => {
    expect(PARA_OPTIONS.map((o) => o.value)).toEqual([
      "project",
      "area",
      "resource",
      "archive",
      "unassigned",
    ]);
  });
});

describe("para 변환", () => {
  it("unassigned <-> null", () => {
    expect(paraParamToCategory("unassigned")).toBeNull();
    expect(paraParamToCategory("project")).toBe("project");
    expect(categoryToParaParam(null)).toBe("unassigned");
    expect(categoryToParaParam("area")).toBe("area");
  });
});

describe("folderMoveOptions", () => {
  it("맨 앞에 미지정(null), 이후 폴더들", () => {
    const opts = folderMoveOptions([
      { id: "a", name: "독서" },
      { id: "b", name: "업무" },
    ]);
    expect(opts).toEqual([
      { id: null, label: "미지정" },
      { id: "a", label: "독서" },
      { id: "b", label: "업무" },
    ]);
  });
});

describe("isDuplicateNameError", () => {
  it("23505만 중복으로 판별", () => {
    expect(isDuplicateNameError("23505")).toBe(true);
    expect(isDuplicateNameError("23503")).toBe(false);
    expect(isDuplicateNameError(undefined)).toBe(false);
  });
});
