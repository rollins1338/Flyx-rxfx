
/* WARNING: Control flow encountered bad instruction data */

void export::get_img_key(void)

{
  int in_register_4ffffff0;
  
  if (in_register_4ffffff0 != 0) {
                    /* WARNING: Bad instruction - Truncating control flow here */
    halt_baddata();
  }
  do {
    halt_trap();
  } while( true );
}

