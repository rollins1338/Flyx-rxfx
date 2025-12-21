
/* WARNING: Removing unreachable block (ram,0x80011fb5) */

void unnamed_function_88(int param1,int param2,undefined8 *param3)

{
  byte bVar1;
  int iVar2;
  ulonglong uVar3;
  uint uVar4;
  ulonglong uVar5;
  undefined1 *local_68;
  int local_64;
  undefined8 local_60;
  undefined8 local_58;
  undefined8 local_50;
  undefined8 local_48;
  undefined1 auStack_40 [56];
  ulonglong local_8;
  
  local_48 = 0;
  local_50 = 0;
  local_58 = 0;
  bVar1 = *(byte *)(param2 + 0x40);
  uVar4 = (uint)bVar1;
  *(undefined1 *)(param2 + uVar4) = 0x80;
  local_60 = 0;
  uVar3 = *(ulonglong *)(param1 + 0x20);
  unnamed_function_267
            (&local_68,uVar4 + 1,param2,0x40,
             &PTR_s_removed_registry_src_index_crate_ram_001001f7_ram_001002cc);
  for (; local_64 != 0; local_64 = local_64 + -1) {
    *local_68 = 0;
    local_68 = local_68 + 1;
  }
  uVar5 = uVar3 << 9;
  local_8 = (ulonglong)bVar1 << 0x3b | ((uVar5 | (ulonglong)bVar1 << 3) & 0xff00) << 0x28 |
            (uVar5 & 0xff0000) << 0x18 | (uVar5 & 0xff000000) << 8 |
            (uVar3 & 0x7f800000) << 1 | uVar3 >> 0xf & 0xff0000 |
            uVar3 >> 0x1f & 0xff00 | uVar5 >> 0x38;
  if ((uVar4 & 0x38) == 0x38) {
    unnamed_function_365(param1,param2);
    memory_fill(0,0x38,0,auStack_40);
    unnamed_function_365(param1,auStack_40);
  }
  else {
    *(ulonglong *)(param2 + 0x38) = local_8;
    unnamed_function_365(param1,param2);
  }
  *(undefined1 *)(param2 + 0x40) = 0;
  for (iVar2 = 0; iVar2 != 0x20; iVar2 = iVar2 + 4) {
    uVar4 = *(uint *)(param1 + iVar2);
    *(uint *)((int)&local_60 + iVar2) =
         uVar4 << 0x18 | (uVar4 & 0xff00) << 8 | uVar4 >> 8 & 0xff00 | uVar4 >> 0x18;
  }
  *param3 = local_60;
  param3[3] = local_48;
  param3[2] = local_50;
  param3[1] = local_58;
  return;
}

