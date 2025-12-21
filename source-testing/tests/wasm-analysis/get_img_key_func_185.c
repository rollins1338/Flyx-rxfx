
void unnamed_function_185(uint *param1,uint *param2,undefined4 param3)

{
  uint param3_00;
  int local_8;
  undefined4 local_4;
  
  param3_00 = param2[2];
  if (param3_00 < *param2) {
    unnamed_function_150(&local_8,param2,param3_00,1,1);
    if (local_8 != -0x7fffffff) {
      unnamed_function_329(local_8,local_4,param3);
      do {
        halt_trap();
      } while( true );
    }
    param3_00 = param2[2];
  }
  param1[1] = param3_00;
  *param1 = param2[1];
  return;
}

