
void unnamed_function_122(int param1,int param2,uint param3)

{
  int param3_00;
  uint uVar1;
  undefined4 local_30;
  undefined4 local_2c;
  undefined4 local_28;
  undefined4 local_24;
  undefined4 local_20;
  undefined4 local_1c;
  undefined4 local_18;
  undefined4 local_14;
  undefined4 local_10;
  undefined4 local_c;
  int local_8;
  uint local_4;
  
  param3_00 = param1 + 0x28;
  uVar1 = (uint)*(byte *)(param1 + 0x68);
  if (param3 < 0x40 - uVar1) {
    unnamed_function_267
              (&local_28,uVar1,param3_00,0x40,
               &PTR_s_removed_registry_src_index_crate_ram_001001f7_ram_0010029c);
    unnamed_function_283
              (&local_30,param3,local_28,local_24,
               &PTR_s_removed_registry_src_index_crate_ram_001001f7_ram_001002ac);
    unnamed_function_273
              (local_30,local_2c,param2,param3,
               &PTR_s_removed_registry_src_index_crate_ram_001001f7_ram_001002bc);
    uVar1 = param3 + uVar1;
  }
  else {
    if (uVar1 != 0) {
      unnamed_function_192
                (&local_10,param2,param3,0x40 - uVar1,
                 &PTR_s_removed_registry_src_index_crate_ram_001001f7_ram_0010024c);
      unnamed_function_267
                (&local_18,uVar1,param3_00,0x40,
                 &PTR_s_removed_registry_src_index_crate_ram_001001f7_ram_0010025c);
      unnamed_function_273
                (local_18,local_14,local_10,local_c,
                 &PTR_s_removed_registry_src_index_crate_ram_001001f7_ram_0010026c);
      unnamed_function_305(param1,param3_00,1);
      param2 = local_8;
      param3 = local_4;
    }
    uVar1 = param3 & 0x3f;
    if (0x3f < param3) {
      unnamed_function_305(param1,param2,param3 >> 6);
    }
    unnamed_function_283
              (&local_20,uVar1,param3_00,0x40,
               &PTR_s_removed_registry_src_index_crate_ram_001001f7_ram_0010027c);
    unnamed_function_273
              (local_20,local_1c,param2 + (param3 & 0xffffffc0),uVar1,
               &PTR_s_removed_registry_src_index_crate_ram_001001f7_ram_0010028c);
  }
  *(char *)(param1 + 0x68) = (char)uVar1;
  return;
}

