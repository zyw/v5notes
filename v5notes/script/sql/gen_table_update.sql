alter table `gen_table` add column `be_type` varchar(10) default "java" comment "后端模版类型" after `gen_path`;
alter table `gen_table` add column `fe_type` varchar(10) default "default" comment "前端模版类型" after `be_type`;


alter table `gen_table_column` rename column `java_type` to `field_type`;
alter table `gen_table_column` rename column `java_field` to `field_name`;

alter table `gen_table_column` modify column `field_type` varchar(500) comment "字段类型";
alter table `gen_table_column` modify column `field_name` varchar(200) comment "字段名称";


alter table `gen_table_column` add column `default_val` varchar(50) comment "默认值" after `field_name`;
alter table `gen_table_column` add column `size` varchar(20) comment "字段长度" after `default_val`;
