-- Comments for user name-related fields introduced by 20260824120000.

COMMENT ON COLUMN "user"."first_name" IS '名（First Name）；展示全名时与 last_name 组合为 FirstName LastName。';
COMMENT ON COLUMN "user"."last_name" IS '姓（Last Name）；由原 name 字段重命名而来。';
COMMENT ON COLUMN "user"."employee_no" IS '员工编号（Employee No.）；与登录用 account / corp_id 区分。';
COMMENT ON COLUMN "user"."rank" IS '职级 / 职衔（Rank）。';
