(func (;132;) (type 9) (param i32 i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32)
    global.get 0
    i32.const 80
    i32.sub
    local.tee 4
    global.set 0
    local.get 4
    i32.const 8
    i32.add
    local.get 0
    local.get 1
    call 241
    local.get 4
    i32.load offset=12
    local.set 1
    local.get 4
    i32.load offset=8
    local.set 0
    local.get 4
    local.get 2
    local.get 3
    call 241
    local.get 4
    i32.load offset=4
    local.set 3
    local.get 4
    i32.load
    local.set 2
    local.get 4
    i32.const 44
    i32.add
    call 206
    block  ;; label = @1
      block  ;; label = @2
        local.get 4
        i32.load offset=44
        local.tee 5
        i32.const -2147483648
        i32.eq
        br_if 0 (;@2;)
        local.get 4
        i32.load offset=48
        local.tee 6
        local.get 4
        i32.load offset=52
        call 1
        local.tee 7
        call 23
        local.set 8
        local.get 7
        call 343
        local.get 5
        local.get 6
        call 359
        br 1 (;@1;)
      end
      local.get 4
      i32.const 20
      i32.add
      local.get 0
      local.get 1
      call 207
      local.get 4
      i32.const 20
      i32.add
      i32.const 12
      i32.add
      local.get 2
      local.get 3
      call 207
      local.get 4
      i32.const 64
      i32.add
      local.get 4
      i32.const 36
      i32.add
      i64.load align=4
      i64.store align=4
      local.get 4
      i32.const 44
      i32.add
      i32.const 12
      i32.add
      local.get 4
      i32.const 28
      i32.add
      i64.load align=4
      i64.store align=4
      local.get 4
      local.get 4
      i64.load offset=20 align=4
      i64.store offset=48 align=4
      local.get 4
      i32.const 0
      i32.store8 offset=72
      local.get 4
      i32.const 1
      i32.store offset=44
      local.get 4
      local.get 4
      i32.const 44
      i32.add
      i32.store offset=76
      local.get 4
      i32.const 76
      i32.add
      i32.const 1049692
      call 24
      local.set 8
      local.get 4
      i32.load offset=44
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      i32.const 48
      i32.add
      call 279
    end
    local.get 2
    local.get 3
    call 327
    local.get 0
    local.get 1
    call 327
    local.get 4
    i32.const 80
    i32.add
    global.set 0
    local.get 8)
  