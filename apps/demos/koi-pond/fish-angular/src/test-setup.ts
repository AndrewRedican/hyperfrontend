// why: Specs load Angular's published libraries without the build's linker pass, so their partially-compiled declarations need the JIT compiler present to finish. The app itself is fully AOT and never ships this import.
import '@angular/compiler'
