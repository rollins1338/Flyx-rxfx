
void unnamed_function_216(undefined4 param1,int *param2)

{
  undefined4 param2_00;
  undefined4 param3;
  
  if (param2[1] == 0) {
    if (param2[3] == 0) {
      param2_00 = 1;
      param3 = 0;
code_r0x80018dbc:
      unnamed_function_207(param1,param2_00,param3);
      return;
    }
  }
  else if ((param2[1] == 1) && (param2[3] == 0)) {
    param3 = ((undefined4 *)*param2)[1];
    param2_00 = *(undefined4 *)*param2;
    goto code_r0x80018dbc;
  }
  unnamed_function_125(param1,param2);
  return;
}

