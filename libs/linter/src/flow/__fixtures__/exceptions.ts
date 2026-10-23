try {
  a()
  throw new Error('x')
} catch (error) {
  b()
}
try {
  a()
} finally {
  b()
}
function returns() {
  try {
    return 1
  } finally {
    cleanup()
  }
  unreachable()
}
function rethrows() {
  try {
    a()
  } catch {
    throw new Error('y')
  } finally {
    cleanup()
  }
  after()
}
function nested() {
  try {
    try {
      a()
    } catch {
      b()
    }
  } catch {
    c()
  }
  try {
    try {
      d()
    } finally {
      e()
    }
  } catch {
    f()
  }
}
function leaves() {
  for (const item of list) {
    try {
      if (item) break
      if (!item) continue
    } finally {
      cleanup()
    }
  }
  try {
    throw new Error('z')
  } finally {
    return 2
  }
}
throw new Error('top')
